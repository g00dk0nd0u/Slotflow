var CustomerAvailabilityConfig = (function () {
  var KEYS = {
    calendarId: 'SLOTFLOW_CALENDAR_ID',
    storeName: 'SLOTFLOW_STORE_NAME',
    phoneNumber: 'SLOTFLOW_STORE_PHONE',
    timezone: 'SLOTFLOW_STORE_TIMEZONE',
    businessHours: 'SLOTFLOW_BUSINESS_HOURS_JSON',
    services: 'SLOTFLOW_SERVICES_JSON'
  };
  var SLOT_STEP_MINUTES = 30;
  var BOOKING_HORIZON_DAYS = 60;

  function load() {
    var properties = PropertiesService.getScriptProperties();
    var calendarId = required(properties, KEYS.calendarId);
    var storeName = required(properties, KEYS.storeName);
    var phoneNumber = required(properties, KEYS.phoneNumber);
    if (!/^\+?[0-9][0-9 -]{7,19}$/.test(phoneNumber)) throw new Error('Invalid phone number');
    var timezone = required(properties, KEYS.timezone);
    Utilities.formatDate(new Date(0), timezone, 'yyyy-MM-dd');
    var businessHours, services;
    try {
      businessHours = JSON.parse(required(properties, KEYS.businessHours));
      services = JSON.parse(required(properties, KEYS.services));
    } catch (error) { throw new Error('Invalid JSON configuration'); }
    validateHours(businessHours);
    validateServices(services);
    return {
      calendarId: calendarId, storeName: storeName, phoneNumber: phoneNumber.replace(/[ -]/g, ''),
      timezone: timezone, businessHours: businessHours, services: services,
      slotStepMinutes: SLOT_STEP_MINUTES, horizonDays: BOOKING_HORIZON_DAYS
    };
  }

  function validateServices(services) {
    if (!Array.isArray(services) || !services.length) throw new Error('Invalid services');
    var ids = {};
    services.forEach(function (service) {
      if (!service || !/^[A-Za-z0-9_-]{1,40}$/.test(service.id || '') ||
          typeof service.name !== 'string' || !service.name.trim() || service.name.length > 80 ||
          !Number.isInteger(service.durationMinutes) || service.durationMinutes < 1 ||
          service.durationMinutes > 1440 || ids[service.id]) throw new Error('Invalid services');
      ids[service.id] = true;
    });
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
