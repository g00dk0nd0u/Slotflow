var CustomerBookingConfig = (function () {
  var KEYS = {
    calendarId: 'SLOTFLOW_CALENDAR_ID',
    timezone: 'SLOTFLOW_STORE_TIMEZONE',
    businessHours: 'SLOTFLOW_BUSINESS_HOURS_JSON'
  };
  var SERVICES = [{ id: 'standard', name: 'ご予約', durationMinutes: 60 }];
  var SLOT_STEP_MINUTES = 30;
  var BOOKING_HORIZON_DAYS = 60;

  function load() {
    var properties = PropertiesService.getScriptProperties();
    var calendarId = required(properties, KEYS.calendarId);
    var timezone = required(properties, KEYS.timezone);
    Utilities.formatDate(new Date(0), timezone, 'yyyy-MM-dd');
    var businessHours;
    try { businessHours = JSON.parse(required(properties, KEYS.businessHours)); }
    catch (error) { throw new Error('Invalid business hours'); }
    validateHours(businessHours);
    return {
      calendarId: calendarId, timezone: timezone, businessHours: businessHours,
      services: SERVICES, slotStepMinutes: SLOT_STEP_MINUTES, horizonDays: BOOKING_HORIZON_DAYS
    };
  }

  function required(properties, key) {
    var value = properties.getProperty(key);
    if (!value || !value.trim()) throw new Error('Missing Script Property: ' + key);
    return value.trim();
  }

  function validateHours(hours) {
    if (!hours || typeof hours !== 'object' || Array.isArray(hours)) throw new Error('Invalid business hours');
    Object.keys(hours).forEach(function (day) {
      if (!/^[0-6]$/.test(day) || !Array.isArray(hours[day])) throw new Error('Invalid business hours');
      hours[day].forEach(function (range) {
        if (!range || !clock(range.start) || !clock(range.end) || range.start >= range.end) throw new Error('Invalid business hours');
      });
    });
  }

  function clock(value) { return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
  return { load: load };
})();
