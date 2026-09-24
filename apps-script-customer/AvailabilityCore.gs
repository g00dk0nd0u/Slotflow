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
      if (!event || event.status === 'cancelled' || event.transparency === 'transparent' || !event.start || !event.end) return;
      if (event.start.date && event.end.date) {
        if (event.start.date <= date && date < event.end.date) intervals.push({ start: -Infinity, end: Infinity });
      } else if (event.start.dateTime && event.end.dateTime) {
        var start = Date.parse(event.start.dateTime), end = Date.parse(event.end.dateTime);
        if (isFinite(start) && isFinite(end) && end > start) intervals.push({ start: start, end: end });
      } else throw new Error('Malformed Calendar event');
    });
    return intervals;
  }

  function slots(date, hours, service, events, timezone, stepMinutes, now) {
    var busy = busyIntervals(events, date, timezone), duration = service.durationMinutes * 60000;
    var result = [];
    hours.forEach(function (range) {
      var cursor = localInstant(date, range.start, timezone).getTime();
      var close = localInstant(date, range.end, timezone).getTime();
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
