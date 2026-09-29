const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadWith(services) {
  const values = {
    SLOTFLOW_CALENDAR_ID: 'private-calendar',
    SLOTFLOW_STORE_NAME: 'Store',
    SLOTFLOW_STORE_PHONE: '+81312345678',
    SLOTFLOW_STORE_TIMEZONE: 'Asia/Tokyo',
    SLOTFLOW_BUSINESS_HOURS_JSON: '{"0":[]}',
    SLOTFLOW_SERVICES_JSON: JSON.stringify(services)
  };
  const context = {
    PropertiesService: { getScriptProperties() { return { getProperty(key) { return values[key]; } }; } },
    Utilities: { formatDate() { return '1970-01-01'; } }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('apps-script-customer/Config.gs', 'utf8'), context);
  return context.CustomerAvailabilityConfig.load;
}

assert.doesNotThrow(() => loadWith([{ id: 'cut', name: 'カット', durationMinutes: 60 }])(),
  'legacy duration services remain valid');
assert.doesNotThrow(() => loadWith([{ id: 'color', name: 'カラー', options: [
  { id: 'short', name: 'ショート', durationMinutes: 90 }
] }])(), 'option-bearing services are valid');

[
  [{ id: 'invalid', name: 'Invalid', durationMinutes: 60, options: [{ id: 'a', name: 'A', durationMinutes: 30 }] }],
  [{ id: 'invalid', name: 'Invalid' }],
  [{ id: 'invalid', name: 'Invalid', options: [] }],
  [{ id: 'invalid', name: 'Invalid', options: [{ id: 'a', name: 'A', durationMinutes: 0 }] }],
  [{ id: 'invalid', name: 'Invalid', options: [
    { id: 'same', name: 'A', durationMinutes: 30 }, { id: 'same', name: 'B', durationMinutes: 60 }
  ] }]
].forEach((services) => {
  assert.throws(() => loadWith(services)(), /Invalid services/);
});

console.log('customer configuration tests passed');
