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
      if (!response || typeof response !== 'object' || Array.isArray(response)) {
        throw new Error('Calendar returned an invalid event list');
      }
      var items = response.items == null ? [] : response.items;
      if (!Array.isArray(items)) {
        throw new Error('Calendar returned an invalid event list');
      }
      events = events.concat(items);
      pageToken = response.nextPageToken;
    } while (pageToken);
    return events;
  }

  return { list: list };
})();
