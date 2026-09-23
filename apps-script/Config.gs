var SlotflowConfig = (function () {
  var KEYS = {
    calendarId: 'SLOTFLOW_CALENDAR_ID',
    timezone: 'SLOTFLOW_STORE_TIMEZONE',
    businessHours: 'SLOTFLOW_BUSINESS_HOURS_JSON'
  };

  function load() {
    var properties = PropertiesService.getScriptProperties();
    var calendarId = required(properties, KEYS.calendarId);
    var timezone = required(properties, KEYS.timezone);
    validateTimezone(timezone);

    var businessHours;
    try {
      businessHours = JSON.parse(required(properties, KEYS.businessHours));
    } catch (error) {
      throw new Error('Invalid ' + KEYS.businessHours + ': expected JSON');
    }
    validateBusinessHours(businessHours);
    return { calendarId: calendarId, timezone: timezone, businessHours: businessHours };
  }

  function required(properties, key) {
    var value = properties.getProperty(key);
    if (!value || !value.trim()) throw new Error('Missing Script Property: ' + key);
    return value.trim();
  }

  function validateTimezone(timezone) {
    try {
      Utilities.formatDate(new Date(0), timezone, 'yyyy-MM-dd');
    } catch (error) {
      throw new Error('Invalid ' + KEYS.timezone + ': ' + timezone);
    }
  }

  function validateBusinessHours(hours) {
    if (!hours || typeof hours !== 'object' || Array.isArray(hours)) {
      throw new Error('Invalid ' + KEYS.businessHours + ': expected an object');
    }
    Object.keys(hours).forEach(function (day) {
      if (!/^[0-6]$/.test(day) || !Array.isArray(hours[day])) {
        throw new Error('Invalid business-hours weekday: ' + day);
      }
      hours[day].forEach(function (range) {
        if (!range || !validClock(range.start) || !validClock(range.end) || range.start >= range.end) {
          throw new Error('Invalid business-hours range for weekday ' + day);
        }
      });
    });
  }

  function validClock(value) {
    return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  return { load: load, KEYS: KEYS };
})();
