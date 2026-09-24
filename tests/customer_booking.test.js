const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

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
      if (options.listFailure) throw new Error('provider details must stay private');
      if (params.privateExtendedProperty) return { items: options.duplicates || [] };
      return { items: events };
    },
    insert(resource, id) {
      inserts += 1;
      if (options.insertFailure) throw new Error('insert failed');
      assert.equal(id, 'private-calendar');
      const properties = JSON.parse(JSON.stringify(resource.extendedProperties.private));
      assert.equal(properties.slotflowRequestId, 'request-id-00001');
      assert.equal(properties.slotflowServiceId, 'standard');
      assert.match(properties.slotflowRequestFingerprint, /^[0-9a-f]{64}$/);
      assert.equal(JSON.stringify(properties).includes('山田'), false, 'private properties contain no raw customer data');
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
    CustomerBookingConfig: { load() { if (options.configFailure) throw new Error('bad secret config'); return config; } },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest(algorithm, value) { return Array.from(crypto.createHash(algorithm).update(value, 'utf8').digest()); },
      formatDate(value, timezone, pattern) {
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
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('apps-script-customer/BookingCore.gs', 'utf8'), context);
  vm.runInContext(fs.readFileSync('apps-script-customer/BookingService.gs', 'utf8'), context);
  return { context, inserts: () => inserts, locked: () => locked };
}

const request = { serviceId: 'standard', start: '2030-01-02T00:00:00.000Z', name: '山田 太郎', contact: '', requestId: 'request-id-00001' };
const occupied = [{ id: 'secret', summary: '秘密の顧客名', start: { dateTime: '2030-01-02T00:30:00Z' }, end: { dateTime: '2030-01-02T01:30:00Z' } }];
const availabilityHarness = harness({ events: occupied });
const bookingOptions = availabilityHarness.context.getBookingOptions();
assert.equal(bookingOptions.timezone, 'Asia/Tokyo');
assert.equal(bookingOptions.storeLocalDate, '2030-01-01');
assert.equal(bookingOptions.bookingHorizonEndDate, '2030-03-02');
const available = availabilityHarness.context.getAvailability({ date: '2030-01-02', serviceId: 'standard' });
assert.equal(available.ok, true);
assert.deepEqual(JSON.parse(JSON.stringify(available.slots)), [
  { start: '2030-01-02T01:30:00.000Z', end: '2030-01-02T02:30:00.000Z' },
  { start: '2030-01-02T02:00:00.000Z', end: '2030-01-02T03:00:00.000Z' }
], 'occupancy removes every overlapping candidate');
assert.equal(JSON.stringify(available).includes('秘密'), false, 'availability never exposes event content');
assert.deepEqual(Object.keys(available).sort(), ['date', 'ok', 'serviceId', 'slots']);

const invalidAvailability = harness().context.getAvailability({ date: 'bad', serviceId: 'standard' });
assert.equal(invalidAvailability.error.code, 'INVALID_REQUEST');
const unavailableAvailability = harness({ listFailure: true }).context
  .getAvailability({ date: '2030-01-02', serviceId: 'standard' });
assert.equal(unavailableAvailability.error.code, 'UNAVAILABLE');
assert.equal(JSON.stringify(unavailableAvailability).includes('provider details'), false);
assert.equal(harness({ configFailure: true }).context.getBookingOptions().error.code, 'UNAVAILABLE');

const stale = harness({ events: occupied });
assert.equal(stale.context.createBooking(request).error.code, 'SLOT_UNAVAILABLE', 'slot is re-read under lock');
assert.equal(stale.inserts(), 0);
assert.equal(stale.locked(), false, 'conflict releases lock');

const lockFailure = harness({ lockFailure: true });
assert.equal(lockFailure.context.createBooking(request).error.code, 'BUSY');
assert.equal(lockFailure.inserts(), 0);

const duplicateEvents = [];
const duplicate = harness({ duplicates: duplicateEvents });
const fingerprint = duplicate.context.requestFingerprint_({
  service: config.services[0], start: request.start, name: request.name.trim(), contact: request.contact.trim()
});
const existing = {
  id: 'existing', status: 'confirmed', start: { dateTime: request.start }, end: { dateTime: '2030-01-02T01:00:00.000Z' },
  extendedProperties: { private: {
    slotflowRequestId: request.requestId, slotflowServiceId: request.serviceId,
    slotflowRequestFingerprint: fingerprint
  } }
};
duplicateEvents.push(existing);
const duplicateResult = duplicate.context.createBooking(Object.assign({}, request, {
  name: '  ' + request.name + '  ', contact: '  ' + request.contact + '  '
}));
assert.equal(duplicateResult.ok, true);
assert.equal(duplicate.inserts(), 0, 'same requestId and normalized payload do not insert a second event');
assert.equal(duplicate.locked(), false);

const changedStart = Object.assign({}, request, { start: '2030-01-02T01:30:00.000Z' });
assert.equal(duplicate.context.createBooking(changedStart).error.code, 'INVALID_REQUEST',
  'same requestId with a different start is rejected');
assert.equal(duplicate.inserts(), 0);

const changedName = Object.assign({}, request, { name: '別の名前' });
assert.equal(duplicate.context.createBooking(changedName).error.code, 'INVALID_REQUEST',
  'same requestId with a different name is rejected');
assert.equal(duplicate.inserts(), 0);

const changedContact = Object.assign({}, request, { contact: 'other@example.com' });
assert.equal(duplicate.context.createBooking(changedContact).error.code, 'INVALID_REQUEST',
  'same requestId with a different contact is rejected');
assert.equal(duplicate.inserts(), 0);

const failedInsert = harness({ insertFailure: true });
const failure = failedInsert.context.createBooking(request);
assert.equal(failure.ok, false, 'Calendar insertion failure never confirms');
assert.equal(failure.error.code, 'UNAVAILABLE');
assert.equal(failedInsert.locked(), false, 'insertion failure releases lock');

const success = harness();
const confirmation = success.context.createBooking(request);
assert.equal(confirmation.ok, true);
assert.equal(success.inserts(), 1);
assert.deepEqual(Object.keys(confirmation.booking).sort(), ['end', 'requestId', 'start'], 'response contains no raw Calendar event');
console.log('customer booking tests passed');
