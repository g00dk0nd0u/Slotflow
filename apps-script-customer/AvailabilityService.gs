function getAvailabilityOptions() {
  try {
    var config = CustomerAvailabilityConfig.load();
    var now = new Date();
    return {
      ok: true,
      storeName: config.storeName,
      phoneNumber: config.phoneNumber,
      phoneHref: 'tel:' + config.phoneNumber,
      timezone: config.timezone,
      storeLocalDate: Utilities.formatDate(now, config.timezone, 'yyyy-MM-dd'),
      availabilityHorizonEndDate: Utilities.formatDate(
        new Date(now.getTime() + config.horizonDays * 24 * 60 * 60000), config.timezone, 'yyyy-MM-dd'),
      services: config.services.map(function (service) {
        return { id: service.id, name: service.name, durationMinutes: service.durationMinutes };
      })
    };
  } catch (error) { return failure_('UNAVAILABLE', '空き状況を取得できません'); }
}

function getAvailability(request) {
  var config;
  try {
    config = CustomerAvailabilityConfig.load();
  } catch (error) {
    return failure_('UNAVAILABLE', '空き時間を取得できません');
  }
  try {
    var input = validateAvailabilityRequest_(request, config, new Date());
  } catch (error) {
    return failure_('INVALID_REQUEST', '入力内容を確認してください');
  }
  try {
    return availability_(input.startDate, input.endDate, input.service, config, new Date());
  } catch (error) { return failure_('UNAVAILABLE', '空き時間を取得できません'); }
}

function availability_(startDate, endDate, service, config, now) {
  var start = CustomerAvailabilityCore.localInstant(startDate, '00:00', config.timezone);
  var afterEnd = nextDate_(endDate, config.timezone);
  var end = CustomerAvailabilityCore.localInstant(afterEnd, '00:00', config.timezone);
  var events = listEvents_(config.calendarId, start.toISOString(), end.toISOString());
  var days = [], date = startDate;
  while (date <= endDate) {
    var instant = CustomerAvailabilityCore.localInstant(date, '00:00', config.timezone);
    var weekday = Number(Utilities.formatDate(instant, config.timezone, 'u')) % 7;
    var slots = CustomerAvailabilityCore.slots(date, config.businessHours[String(weekday)] || [], service,
      events, config.timezone, config.slotStepMinutes, now);
    days.push({ date: date, status: CustomerAvailabilityCore.status(slots.length),
      ranges: CustomerAvailabilityCore.ranges(slots, config.timezone, config.slotStepMinutes) });
    date = nextDate_(date, config.timezone);
  }
  return { ok: true, serviceId: service.id, days: days };
}

function nextDate_(date, timezone) {
  var instant = CustomerAvailabilityCore.localInstant(date, '12:00', timezone);
  return Utilities.formatDate(new Date(instant.getTime() + 24 * 60 * 60000), timezone, 'yyyy-MM-dd');
}

function listEvents_(calendarId, timeMin, timeMax, extra) {
  var params = { singleEvents: true, showDeleted: true, maxResults: 2500 };
  if (timeMin) params.timeMin = timeMin;
  if (timeMax) params.timeMax = timeMax;
  if (extra) Object.keys(extra).forEach(function (key) { params[key] = extra[key]; });
  var items = [], token;
  do {
    params.pageToken = token;
    var response = Calendar.Events.list(calendarId, params);
    if (!response || !Array.isArray(response.items || [])) throw new Error('Calendar read failed');
    items = items.concat(response.items || []); token = response.nextPageToken;
  } while (token);
  return items;
}

function validateAvailabilityRequest_(request, config, now) {
  if (!request || typeof request !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(request.startDate || '') ||
      !/^\d{4}-\d{2}-\d{2}$/.test(request.endDate || '') || request.startDate > request.endDate) invalid_();
  var service = config.services.filter(function (item) { return item.id === request.serviceId; })[0];
  if (!service) invalid_();
  var today = Utilities.formatDate(now, config.timezone, 'yyyy-MM-dd');
  var limit = Utilities.formatDate(new Date(now.getTime() + config.horizonDays * 24 * 60 * 60000), config.timezone, 'yyyy-MM-dd');
  if (request.startDate < today || request.endDate > limit ||
      Date.parse(request.endDate + 'T00:00:00Z') - Date.parse(request.startDate + 'T00:00:00Z') > 31 * 86400000) invalid_();
  return { startDate: request.startDate, endDate: request.endDate, service: service };
}

function invalid_() { var error = new Error('Invalid request'); error.code = 'INVALID_REQUEST'; throw error; }
function failure_(code, message) { return { ok: false, error: { code: code, message: message } }; }
