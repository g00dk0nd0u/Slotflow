function getBookingOptions() {
  try {
    var config = CustomerBookingConfig.load();
    return { ok: true, services: config.services.map(function (service) { return { id: service.id, name: service.name }; }) };
  } catch (error) { return failure_('UNAVAILABLE', '予約情報を取得できません'); }
}

function getAvailability(request) {
  try {
    var config = CustomerBookingConfig.load();
    var input = validateAvailabilityRequest_(request, config, new Date());
    return availability_(input.date, input.service, config, new Date());
  } catch (error) { return failure_(error.code || 'INVALID_REQUEST', error.publicMessage || '入力内容を確認してください'); }
}

function createBooking(request) {
  var lock;
  try {
    var config = CustomerBookingConfig.load();
    var now = new Date();
    var input = validateBookingRequest_(request, config, now);
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return failure_('BUSY', 'ただいま予約が混み合っています。もう一度お試しください');

    var fingerprint = requestFingerprint_(input);
    var duplicate = findByRequestId_(config.calendarId, input.requestId);
    if (duplicate) {
      if (!duplicate.extendedProperties || !duplicate.extendedProperties.private ||
          duplicate.extendedProperties.private.slotflowRequestFingerprint !== fingerprint) {
        return failure_('INVALID_REQUEST', 'リクエストIDが一致しません');
      }
      return success_(input.requestId, duplicate.start.dateTime, duplicate.end.dateTime);
    }

    var availability = availability_(input.date, input.service, config, now);
    if (!availability.ok) return availability;
    if (!CustomerBookingCore.containsSlot(availability.slots, input.start)) {
      return failure_('SLOT_UNAVAILABLE', '選択した時間は予約できなくなりました');
    }
    var end = new Date(Date.parse(input.start) + input.service.durationMinutes * 60000).toISOString();
    var event = Calendar.Events.insert({
      summary: input.service.name + ' - ' + input.name,
      description: input.contact ? '連絡先: ' + input.contact : undefined,
      start: { dateTime: input.start, timeZone: config.timezone },
      end: { dateTime: end, timeZone: config.timezone },
      extendedProperties: { private: {
        slotflowRequestId: input.requestId,
        slotflowServiceId: input.service.id,
        slotflowRequestFingerprint: fingerprint
      } }
    }, config.calendarId);
    if (!event || !event.id) throw new Error('Calendar insert failed');
    return success_(input.requestId, input.start, end);
  } catch (error) {
    return failure_(error.code || 'BOOKING_FAILED', error.publicMessage || '予約を確定できませんでした');
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function availability_(date, service, config, now) {
  var start = CustomerBookingCore.localInstant(date, '00:00', config.timezone);
  var nextDate = Utilities.formatDate(new Date(start.getTime() + 36 * 60 * 60000), config.timezone, 'yyyy-MM-dd');
  var end = CustomerBookingCore.localInstant(nextDate, '00:00', config.timezone);
  var events = listEvents_(config.calendarId, start.toISOString(), end.toISOString());
  var weekday = Number(Utilities.formatDate(start, config.timezone, 'u')) % 7;
  return { ok: true, date: date, serviceId: service.id,
    slots: CustomerBookingCore.slots(date, config.businessHours[String(weekday)] || [], service,
      events, config.timezone, config.slotStepMinutes, now) };
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

function findByRequestId_(calendarId, requestId) {
  return listEvents_(calendarId, null, null,
    { privateExtendedProperty: 'slotflowRequestId=' + requestId }).filter(function (event) {
      return event.status !== 'cancelled' && event.extendedProperties && event.extendedProperties.private &&
        event.extendedProperties.private.slotflowRequestId === requestId;
    })[0] || null;
}

function requestFingerprint_(input) {
  var canonical = JSON.stringify([input.service.id, input.start, input.name, input.contact]);
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, canonical, Utilities.Charset.UTF_8)
    .map(function (value) { return ('0' + ((value + 256) % 256).toString(16)).slice(-2); }).join('');
}

function validateAvailabilityRequest_(request, config, now) {
  if (!request || typeof request !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(request.date || '')) invalid_();
  var service = config.services.filter(function (item) { return item.id === request.serviceId; })[0];
  if (!service) invalid_();
  var today = Utilities.formatDate(now, config.timezone, 'yyyy-MM-dd');
  var limit = Utilities.formatDate(new Date(now.getTime() + config.horizonDays * 24 * 60 * 60000), config.timezone, 'yyyy-MM-dd');
  if (request.date < today || request.date > limit) invalid_();
  return { date: request.date, service: service };
}

function validateBookingRequest_(request, config, now) {
  if (!request || typeof request !== 'object' || typeof request.start !== 'string' ||
      !/^[-A-Za-z0-9_]{16,100}$/.test(request.requestId || '') ||
      typeof request.name !== 'string' || !request.name.trim() || request.name.trim().length > 80 ||
      (request.contact != null && (typeof request.contact !== 'string' || request.contact.trim().length > 200))) invalid_();
  var start = new Date(request.start);
  if (isNaN(start.getTime()) || start.toISOString() !== request.start) invalid_();
  var date = Utilities.formatDate(start, config.timezone, 'yyyy-MM-dd');
  var base = validateAvailabilityRequest_({ date: date, serviceId: request.serviceId }, config, now);
  return { requestId: request.requestId, name: request.name.trim(), contact: (request.contact || '').trim(),
    start: request.start, date: date, service: base.service };
}

function invalid_() { var error = new Error('Invalid request'); error.code = 'INVALID_REQUEST'; throw error; }
function failure_(code, message) { return { ok: false, error: { code: code, message: message } }; }
function success_(requestId, start, end) { return { ok: true, booking: { requestId: requestId, start: start, end: end } }; }
