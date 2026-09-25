const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const config = {
  calendarId: 'private-calendar', storeName: 'Slotflow Salon', phoneNumber: '+81312345678', timezone: 'Asia/Tokyo',
  businessHours: { '3': [{ start: '09:00', end: '12:00' }] },
  services: [{ id: 'standard', name: 'カット', durationMinutes: 60 }], slotStepMinutes: 30, horizonDays: 60
};

function formatDate(value, timezone, pattern) {
  assert.equal(timezone, 'Asia/Tokyo');
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  if (pattern === 'yyyy-MM-dd') return `${p.year}-${p.month}-${p.day}`;
  if (pattern === 'u') return String(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday) + 1);
  if (pattern === 'Z') return '+0900';
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  if (pattern === 'HH:mm') return time;
  if (pattern === 'yyyy-MM-dd HH:mm') return `${p.year}-${p.month}-${p.day} ${time}`;
  throw new Error(`unexpected pattern ${pattern}`);
}

function harness(options = {}) {
  class FakeDate extends Date {
    constructor(value) { super(value === undefined ? '2030-01-01T00:00:00.000Z' : value); }
    static now() { return Date.parse('2030-01-01T00:00:00.000Z'); }
  }
  const context = {
    Date: FakeDate,
    Calendar: { Events: { list(id) {
      assert.equal(id, 'private-calendar');
      if (options.listFailure) throw new Error('private provider failure');
      return options.providerResponse === undefined ? { items: options.events || [] } : options.providerResponse;
    } } },
    CustomerAvailabilityConfig: { load() { if (options.configFailure) throw new Error('private config'); return config; } },
    Utilities: { formatDate }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('apps-script-customer/AvailabilityCore.gs', 'utf8'), context);
  vm.runInContext(fs.readFileSync('apps-script-customer/AvailabilityService.gs', 'utf8'), context);
  return context;
}

const options = harness().getAvailabilityOptions();
assert.deepEqual(JSON.parse(JSON.stringify(options)), {
  ok: true, storeName: 'Slotflow Salon', phoneNumber: '+81312345678', phoneHref: 'tel:+81312345678',
  timezone: 'Asia/Tokyo', storeLocalDate: '2030-01-01', availabilityHorizonEndDate: '2030-03-02',
  services: [{ id: 'standard', name: 'カット', durationMinutes: 60 }]
}, 'server configuration is the only source of customer options and tel link');

const occupied = [
  { summary: '秘密の顧客名', description: 'secret', attendees: [{ email: 'secret@example.com' }], start: { dateTime: '2030-01-02T00:30:00Z' }, end: { dateTime: '2030-01-02T01:30:00Z' } },
  { transparency: 'transparent', start: { dateTime: '2030-01-02T01:30:00Z' }, end: { dateTime: '2030-01-02T02:00:00Z' } },
  { status: 'cancelled', start: { dateTime: '2030-01-02T01:30:00Z' }, end: { dateTime: '2030-01-02T02:00:00Z' } }
];
const result = harness({ events: occupied }).getAvailability({ startDate: '2030-01-02', endDate: '2030-01-02', serviceId: 'standard' });
assert.deepEqual(JSON.parse(JSON.stringify(result)), { ok: true, serviceId: 'standard', days: [
  { date: '2030-01-02', status: '△', ranges: ['10:30 ～ 11:00'] }
]}, 'business hours, occupancy, duration, status, grouping, and timezone are applied');
assert.equal(JSON.stringify(result).includes('秘密'), false);
assert.equal(JSON.stringify(result).includes('secret@example.com'), false, 'no private event data is returned');

const core = harness().CustomerAvailabilityCore;
assert.equal(core.status(0), '×'); assert.equal(core.status(1), '△'); assert.equal(core.status(2), '△'); assert.equal(core.status(3), '○');
assert.equal(core.slots('2030-01-02', [{ start: '09:00', end: '10:00' }], { durationMinutes: 90 }, [], 'Asia/Tokyo', 30, new Date('2029-01-01')).length, 0, 'service must fit fully');
assert.equal(core.slots('2030-01-02', [{ start: '09:00', end: '12:00' }], config.services[0], [{ start: { date: '2030-01-02' }, end: { date: '2030-01-03' } }], 'Asia/Tokyo', 30, new Date('2029-01-01')).length, 0, 'opaque all-day events block the date');
assert.equal(core.slots('2030-01-02', [{ start: '09:00', end: '12:00' }], config.services[0], [{ transparency: 'transparent', start: { date: '2030-01-02' }, end: { date: '2030-01-03' } }], 'Asia/Tokyo', 30, new Date('2029-01-01')).length, 5, 'transparent all-day events do not block');
assert.equal(core.slots('2030-01-02', [
  { start: '09:00', end: '11:00' }, { start: '10:00', end: '12:00' }
], config.services[0], [], 'Asia/Tokyo', 30, new Date('2029-01-01')).length, 5,
'overlapping business-hour windows do not duplicate slots');
assert.equal(core.slots('2030-01-02', [
  { start: '09:00', end: '10:00' }, { start: '10:00', end: '11:00' }
], config.services[0], [], 'Asia/Tokyo', 30, new Date('2029-01-01')).length, 2,
'a service must fit within one of adjacent business-hour windows');
assert.throws(() => core.busyIntervals([null], '2030-01-02', 'Asia/Tokyo'), /Malformed Calendar event/);
assert.throws(() => core.busyIntervals([{ start: {}, end: {} }], '2030-01-02', 'Asia/Tokyo'), /Malformed Calendar event/);
assert.throws(() => core.busyIntervals([{ start: { dateTime: '2030-01-02 10:00' }, end: { dateTime: '2030-01-02T11:00:00Z' } }], '2030-01-02', 'Asia/Tokyo'), /Malformed timed Calendar event/);
assert.throws(() => core.busyIntervals([{ start: { date: '2030-02-30' }, end: { date: '2030-03-02' } }], '2030-01-02', 'Asia/Tokyo'), /Malformed all-day Calendar event/);
assert.deepEqual(JSON.parse(JSON.stringify(core.busyIntervals([{ status: 'cancelled' }], '2030-01-02', 'Asia/Tokyo'))), [],
'deleted cancelled events may omit interval data');
assert.equal(harness({ listFailure: true }).getAvailability({ startDate: '2030-01-02', endDate: '2030-01-02', serviceId: 'standard' }).error.code, 'UNAVAILABLE', 'provider failure is not free availability');
for (const providerResponse of ['unexpected', [], { items: null }, { items: 'unexpected' }, { items: [], nextPageToken: 42 }]) {
  const failure = harness({ providerResponse }).getAvailability({ startDate: '2030-01-02', endDate: '2030-01-02', serviceId: 'standard' });
  assert.equal(failure.error.code, 'UNAVAILABLE', 'malformed provider data fails closed');
  assert.equal(Object.hasOwn(failure, 'days'), false, 'malformed provider data never resembles free availability');
}
const malformedEvent = harness({ events: [null] }).getAvailability({ startDate: '2030-01-02', endDate: '2030-01-02', serviceId: 'standard' });
assert.equal(malformedEvent.error.code, 'UNAVAILABLE', 'malformed provider event fails closed');
assert.equal(Object.hasOwn(malformedEvent, 'days'), false);
assert.equal(harness({ configFailure: true }).getAvailabilityOptions().error.code, 'UNAVAILABLE');
console.log('customer availability tests passed');
