var ScheduleCore = (function () {
  function normalizeEvent(event) {
    if (!event || !event.id || !event.start || !event.end) throw new Error('Malformed Calendar event');
    var allDay = Boolean(event.start.date || event.end.date);
    if (allDay && !(event.start.date && event.end.date)) throw new Error('Malformed all-day Calendar event');
    if (!allDay && !(event.start.dateTime && event.end.dateTime)) throw new Error('Malformed timed Calendar event');
    var start = allDay ? event.start.date : instant(event.start.dateTime);
    var end = allDay ? event.end.date : instant(event.end.dateTime);
    if (end <= start) throw new Error('Calendar event has a non-positive interval');
    return {
      id: String(event.id),
      title: event.summary ? String(event.summary) : '(untitled)',
      start: start,
      end: end,
      allDay: allDay,
      busy: event.status !== 'cancelled' && event.transparency !== 'transparent'
    };
  }

  function instant(value) {
    if (typeof value !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(value) || isNaN(Date.parse(value))) {
      throw new Error('Timed event must use an ISO-8601 instant with an offset');
    }
    return new Date(value).toISOString();
  }

  function mergeIntervals(intervals) {
    var sorted = intervals.map(function (item) {
      return { start: new Date(item.start).getTime(), end: new Date(item.end).getTime() };
    }).filter(function (item) { return item.end > item.start; })
      .sort(function (a, b) { return a.start - b.start || a.end - b.end; });
    return sorted.reduce(function (merged, item) {
      var last = merged[merged.length - 1];
      if (!last || item.start > last.end) merged.push(item);
      else if (item.end > last.end) last.end = item.end;
      return merged;
    }, []);
  }

  function freeGaps(window, busy) {
    var start = new Date(window.start).getTime();
    var end = new Date(window.end).getTime();
    var cursor = start;
    var gaps = [];
    mergeIntervals(busy).forEach(function (item) {
      var clippedStart = Math.max(start, item.start);
      var clippedEnd = Math.min(end, item.end);
      if (clippedEnd <= start || clippedStart >= end) return;
      if (clippedStart > cursor) gaps.push(isoInterval(cursor, clippedStart));
      cursor = Math.max(cursor, clippedEnd);
    });
    if (cursor < end) gaps.push(isoInterval(cursor, end));
    return gaps;
  }

  function derive(events, now, day, dayWindow, businessWindows) {
    var timed = events.filter(function (event) {
      return !event.allDay && event.end > dayWindow.start && event.start < dayWindow.end;
    }).sort(byStart);
    var allDay = events.filter(function (event) {
      return event.allDay && event.start <= day && day < event.end;
    }).sort(byStart);
    var relevant = timed.filter(function (event) { return event.end > now; });
    var currentOrNext = relevant.length ? relevant[0] : null;
    var allDayBusy = allDay.some(function (event) { return event.busy; });
    var busyTimed = timed.filter(function (event) { return event.busy; });
    var gaps = [];
    businessWindows.forEach(function (window) {
      if (!allDayBusy) gaps = gaps.concat(freeGaps(window, busyTimed));
    });
    return { allDayEvents: allDay, timedEvents: timed, currentOrNextEvent: currentOrNext, freeGaps: gaps };
  }

  function byStart(a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; }
  function isoInterval(start, end) { return { start: new Date(start).toISOString(), end: new Date(end).toISOString() }; }

  return { normalizeEvent: normalizeEvent, mergeIntervals: mergeIntervals, freeGaps: freeGaps, derive: derive };
})();
