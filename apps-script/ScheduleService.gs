/** Server-side Apps Script callable. This is deliberately not an HTTP doGet endpoint. */
function getDashboardSchedule() {
  var generatedAt = new Date();
  try {
    var config = SlotflowConfig.load();
    var day = Utilities.formatDate(generatedAt, config.timezone, 'yyyy-MM-dd');
    var dayStart = localInstant(day, '00:00', config.timezone);
    var tomorrow = Utilities.formatDate(new Date(dayStart.getTime() + 36 * 60 * 60 * 1000), config.timezone, 'yyyy-MM-dd');
    var dayEnd = localInstant(tomorrow, '00:00', config.timezone);
    var upcomingEnd = new Date(dayEnd.getTime() + 7 * 24 * 60 * 60 * 1000);
    var rawEvents = CalendarReadAdapter.list(config.calendarId, dayStart.toISOString(), upcomingEnd.toISOString());
    var events = rawEvents.filter(function (event) {
      return event.status !== 'cancelled';
    }).map(ScheduleCore.normalizeEvent);
    var weekday = Number(Utilities.formatDate(dayStart, config.timezone, 'u')) % 7;
    var windows = (config.businessHours[String(weekday)] || []).map(function (range) {
      return {
        start: localInstant(day, range.start, config.timezone).toISOString(),
        end: localInstant(day, range.end, config.timezone).toISOString()
      };
    });
    var today = ScheduleCore.derive(events, generatedAt.toISOString(), day,
      { start: dayStart.toISOString(), end: dayEnd.toISOString() }, windows);
    var upcomingEvents = events.filter(function (event) {
      return !event.allDay && event.start >= dayEnd.toISOString() && event.start < upcomingEnd.toISOString();
    }).sort(function (a, b) { return a.start < b.start ? -1 : 1; }).slice(0, 20);
    if (!today.currentOrNextEvent) {
      today.currentOrNextEvent = events.filter(function (event) {
        return !event.allDay && event.end > generatedAt.toISOString();
      }).sort(function (a, b) { return a.start < b.start ? -1 : 1; })[0] || null;
    }

    return {
      ok: true,
      generatedAt: generatedAt.toISOString(),
      timezone: config.timezone,
      storeLocalDate: day,
      today: today,
      upcomingEvents: upcomingEvents
    };
  } catch (error) {
    return {
      ok: false,
      generatedAt: generatedAt.toISOString(),
      error: { code: 'SCHEDULE_UNAVAILABLE', message: 'Schedule data is unavailable' }
    };
  }
}

// Converts a store-local civil time to an instant. A second pass handles DST offset changes.
function localInstant(date, clock, timezone) {
  var parts = date.split('-').map(Number);
  var time = clock.split(':').map(Number);
  var wallUtc = Date.UTC(parts[0], parts[1] - 1, parts[2], time[0], time[1]);
  var guess = new Date(wallUtc);
  for (var i = 0; i < 2; i += 1) {
    var offset = Utilities.formatDate(guess, timezone, 'Z');
    var sign = offset.charAt(0) === '-' ? -1 : 1;
    var minutes = sign * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(3, 5)));
    guess = new Date(wallUtc - minutes * 60 * 1000);
  }
  if (Utilities.formatDate(guess, timezone, 'yyyy-MM-dd HH:mm') !== date + ' ' + clock) {
    throw new Error('Invalid or ambiguous store-local time: ' + date + ' ' + clock);
  }
  return guess;
}
