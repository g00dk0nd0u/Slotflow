const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const config = {
  calendarId: 'private-calendar', timezone: 'Asia/Tokyo',
  businessHours: { '3': [{ start: '09:00', end: '12:00' }] },
  services: [{ id: 'standard', name: 'ご予約', durationMinutes: 60 }],
  slotStepMinutes: 30, horizonDays: 60
};

function harness(options = {}) {
  let inserts = 0;
  let locked = false;
  const events = options.events || [];
  const Calendar = { Events: {
    list(id, params) {
      assert.equal(id, 'private-calendar');
      if (params.privateExtendedProperty) {
        assert.equal(params.privateExtendedProperty, 'slotflowRequestId=request-id-00001');
        return { items: options.duplicates || [] };
      }
      return { items: events };
    },
    insert(resource, id) {
      inserts += 1;
      if (options.insertFailure) throw new Error('insert failed');
      assert.equal(id, 'private-calendar');
      assert.deepEqual(JSON.parse(JSON.stringify(resource.extendedProperties.private)),
        { slotflowRequestId: 'request-id-00001', slotflowServiceId: 'standard' });
      return { id: 'new-event' };
    }
  } };
  const lock = {
    tryLock() { if (options.lockFailure) return false; locked = true; return true; },
    hasLock() { return locked; },
    releaseLock() { locked = false; }
  };
  class FakeDate extends Date {
    constructor(value) { super(value === undefined ? '2030-01-01T00:00:00.000Z' : value); }
    static now() { return Date.parse('2030-01-01T00:00:00.000Z'); }
  }
  const context = {
    Date: FakeDate, Calendar, LockService: { getScriptLock() { return lock; } },
    CustomerBookingConfig: { load() { return config; } },
    Utilities: { formatDate(value, timezone, pattern) {
      assert.equal(timezone, 'Asia/Tokyo');
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(value);
      const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
      if (pattern === 'yyyy-MM-dd') return `${p.year}-${p.month}-${p.day}`;
      if (pattern === 'u') return String(['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(p.weekday) + 1);
      if (pattern === 'Z') return '+0900';
      if (pattern === 'yyyy-MM-dd HH:mm') {
        const t = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false }).format(value);
        return `${p.year}-${p.month}-${p.day} ${t}`;
      }
      throw new Error(`unexpected pattern ${pattern}`);
    } }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('apps-script-customer/BookingCore.gs', 'utf8'), context);
  vm.runInContext(fs.readFileSync('apps-script-customer/BookingService.gs', 'utf8'), context);
  return { context, inserts: () => inserts, locked: () => locked };
}

const request = { serviceId: 'standard', start: '2030-01-02T00:00:00.000Z', name: '山田 太郎', contact: '', requestId: 'request-id-00001' };
const occupied = [{ id: 'secret', summary: '秘密の顧客名', start: { dateTime: '2030-01-02T00:30:00Z' }, end: { dateTime: '2030-01-02T01:30:00Z' } }];
const availabilityHarness = harness({ events: occupied });
const options = availabilityHarness.context.getBookingOptions();
assert.equal(options.timezone, 'Asia/Tokyo');
assert.equal(options.storeLocalDate, '2030-01-01');
assert.equal(options.bookingHorizonEndDate, '2030-03-02');
const available = availabilityHarness.context.getAvailability({ date: '2030-01-02', serviceId: 'standard' });
assert.equal(available.ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(available.slots)), [
  { start: '2030-01-02T01:30:00.000Z', end: '2030-01-02T02:30:00.000Z' },
  { start: '2030-01-02T02:00:00.000Z', end: '2030-01-02T03:00:00.000Z' }
], 'occupancy removes every overlapping candidate');
assert.equal(JSON.stringify(available).includes('秘密'), false, 'availability never exposes event content');
assert.deepEqual(Object.keys(available).sort(), ['date', 'ok', 'serviceId', 'slots']);
const providerFailure = harness();
providerFailure.context.Calendar.Events.list = function () { throw new Error('private provider detail'); };
const unavailable = providerFailure.context.getAvailability({ date: '2030-01-02', serviceId: 'standard' });
assert.equal(unavailable.error.code, 'UNAVAILABLE');
assert.equal(JSON.stringify(unavailable).includes('private provider detail'), false);
assert.equal(harness().context.getAvailability({ date: 'not-a-date', serviceId: 'standard' }).error.code, 'INVALID_REQUEST');

const stale = harness({ events: occupied });
assert.equal(stale.context.createBooking(request).error.code, 'SLOT_UNAVAILABLE', 'slot is re-read under lock');
assert.equal(stale.inserts(), 0);
assert.equal(stale.locked(), false, 'conflict releases lock');

const lockFailure = harness({ lockFailure: true });
assert.equal(lockFailure.context.createBooking(request).error.code, 'BUSY');
assert.equal(lockFailure.inserts(), 0);

const existing = {
  id: 'existing', status: 'confirmed', start: { dateTime: request.start }, end: { dateTime: '2030-01-02T01:00:00.000Z' },
  extendedProperties: { private: { slotflowRequestId: request.requestId, slotflowServiceId: request.serviceId } }
};
const duplicate = harness({ duplicates: [existing] });
const duplicateResult = duplicate.context.createBooking(request);
assert.equal(duplicateResult.ok, true);
assert.equal(duplicate.inserts(), 0, 'same requestId does not insert a second event');
assert.equal(duplicate.locked(), false);

const failedInsert = harness({ insertFailure: true });
const failure = failedInsert.context.createBooking(request);
assert.equal(failure.ok, false, 'Calendar insertion failure never confirms');
assert.equal(failure.error.code, 'BOOKING_FAILED');
assert.equal(failedInsert.locked(), false, 'insertion failure releases lock');

const success = harness();
const confirmation = success.context.createBooking(request);
assert.equal(confirmation.ok, true);
assert.equal(success.inserts(), 1);
assert.deepEqual(Object.keys(confirmation.booking).sort(), ['end', 'requestId', 'start'], 'response contains no raw Calendar event');
console.log('customer booking tests passed');
