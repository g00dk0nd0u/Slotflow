var CustomerAvailabilityCore = (function () {
  function localInstant(date, clock, timezone) {
    var parts = date.split('-').map(Number), time = clock.split(':').map(Number);
    var wallUtc = Date.UTC(parts[0], parts[1] - 1, parts[2], time[0], time[1]);
    var guess = new Date(wallUtc);
    for (var i = 0; i < 2; i += 1) {
      var offset = Utilities.formatDate(guess, timezone, 'Z');
      var sign = offset.charAt(0) === '-' ? -1 : 1;
      var minutes = sign * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(3, 5)));
      guess = new Date(wallUtc - minutes * 60000);
    }
    if (Utilities.formatDate(guess, timezone, 'yyyy-MM-dd HH:mm') !== date + ' ' + clock) throw new Error('Invalid local time');
    return guess;
  }

  function busyIntervals(events, date, timezone) {
    var intervals = [];
    events.forEach(function (event) {
      if (event && (event.status === 'cancelled' || event.transparency === 'transparent')) return;
      if (!event || typeof event !== 'object' || !event.start || !event.end) throw new Error('Malformed Calendar event');
      if (event.start.date && event.end.date) {
        if (!validDate(event.start.date) || !validDate(event.end.date) || event.end.date <= event.start.date) {
          throw new Error('Malformed all-day Calendar event');
        }
        if (event.start.date <= date && date < event.end.date) intervals.push({ start: -Infinity, end: Infinity });
      } else if (event.start.dateTime && event.end.dateTime) {
        var start = eventInstant(event.start), end = eventInstant(event.end);
        if (end <= start) throw new Error('Malformed timed Calendar event');
        intervals.push({ start: start, end: end });
      } else throw new Error('Malformed Calendar event');
    });
    return intervals;
  }

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var parts = value.split('-').map(Number), parsed = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return parsed.getUTCFullYear() === parts[0] && parsed.getUTCMonth() === parts[1] - 1 && parsed.getUTCDate() === parts[2];
  }

  function eventInstant(value) {
    if (!value || typeof value !== 'object' || typeof value.dateTime !== 'string') {
      throw new Error('Malformed timed Calendar event');
    }
    if (value.timeZone !== undefined) validateTimezone(value.timeZone);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value.dateTime)) {
      var instant = Date.parse(value.dateTime);
      if (isFinite(instant)) return instant;
      throw new Error('Malformed timed Calendar event');
    }
    var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(value.dateTime);
    if (!match || value.timeZone === undefined) throw new Error('Malformed timed Calendar event');
    var milliseconds = Number(((match[7] || '') + '000').slice(0, 3));
    var wallUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]),
      Number(match[4]), Number(match[5]), Number(match[6]), milliseconds);
    var guess = new Date(wallUtc);
    for (var i = 0; i < 3; i += 1) {
      var offset = Utilities.formatDate(guess, value.timeZone, 'Z');
      var sign = offset.charAt(0) === '-' ? -1 : 1;
      var minutes = sign * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(3, 5)));
      guess = new Date(wallUtc - minutes * 60000);
    }
    var expected = match[1] + '-' + match[2] + '-' + match[3] + ' ' + match[4] + ':' + match[5] + ':' + match[6];
    if (Utilities.formatDate(guess, value.timeZone, 'yyyy-MM-dd HH:mm:ss') !== expected) {
      throw new Error('Malformed timed Calendar event');
    }
    return guess.getTime();
  }

  function validateTimezone(timezone) {
    if (typeof timezone !== 'string' || !/^[A-Za-z][A-Za-z0-9._+-]*(?:\/[A-Za-z0-9._+-]+)*$/.test(timezone)) {
      throw new Error('Malformed timed Calendar event');
    }
    try { Utilities.formatDate(new Date(0), timezone, 'yyyy-MM-dd'); }
    catch (error) { throw new Error('Malformed timed Calendar event'); }
  }

  function slots(date, hours, service, events, timezone, stepMinutes, now) {
    var busy = busyIntervals(events, date, timezone), duration = service.durationMinutes * 60000;
    var windows = hours.map(function (range) {
      return {
        start: localInstant(date, range.start, timezone).getTime(),
        end: localInstant(date, range.end, timezone).getTime()
      };
    }).sort(function (left, right) { return left.start - right.start || left.end - right.end; })
      .reduce(function (merged, window) {
        var previous = merged[merged.length - 1];
        if (!previous || window.start > previous.end) merged.push(window);
        else if (window.end > previous.end) previous.end = window.end;
        return merged;
      }, []);
    var result = [];
    windows.forEach(function (window) {
      var cursor = window.start, close = window.end;
      for (; cursor + duration <= close; cursor += stepMinutes * 60000) {
        var end = cursor + duration;
        if (cursor >= now.getTime() && !busy.some(function (item) { return item.start < end && cursor < item.end; })) {
          result.push({ start: new Date(cursor).toISOString(), end: new Date(end).toISOString() });
        }
      }
    });
    return result;
  }

  function status(slotCount) {
    return slotCount === 0 ? '×' : slotCount <= 2 ? '△' : '○';
  }

  function ranges(slots, timezone, stepMinutes) {
    if (!slots.length) return [];
    var result = [], start = slots[0].start, previous = slots[0].start;
    for (var i = 1; i < slots.length; i += 1) {
      if (Date.parse(slots[i].start) - Date.parse(previous) !== stepMinutes * 60000) {
        result.push(clock(start, timezone) + ' ～ ' + clock(previous, timezone));
        start = slots[i].start;
      }
      previous = slots[i].start;
    }
    result.push(clock(start, timezone) + ' ～ ' + clock(previous, timezone));
    return result;
  }

  function clock(instant, timezone) {
    return Utilities.formatDate(new Date(instant), timezone, 'HH:mm');
  }
  return { localInstant: localInstant, busyIntervals: busyIntervals, slots: slots, status: status, ranges: ranges };
})();
