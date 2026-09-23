var CalendarReadAdapter = (function () {
  function list(calendarId, timeMin, timeMax) {
    if (typeof Calendar === 'undefined' || !Calendar.Events || !Calendar.Events.list) {
      throw new Error('Advanced Calendar service is unavailable');
    }
    var events = [];
    var pageToken;
    do {
      var response = Calendar.Events.list(calendarId, {
        timeMin: timeMin,
        timeMax: timeMax,
        singleEvents: true,
        orderBy: 'startTime',
        showDeleted: true,
        maxResults: 2500,
        pageToken: pageToken
      });
      if (!response || !Array.isArray(response.items)) {
        throw new Error('Calendar returned an invalid event list');
      }
      events = events.concat(response.items);
      pageToken = response.nextPageToken;
    } while (pageToken);
    return events;
  }

  return { list: list };
})();
