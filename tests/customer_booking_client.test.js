const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Element {
  constructor() { this.children = []; this._text = ''; this.value = ''; this.disabled = false; this.hidden = false; this.className = ''; }
  appendChild(child) { this.children.push(child); return child; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text; }
}

const ids = ['service', 'date', 'times', 'name', 'contact', 'confirm', 'result'];
const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
const calls = [];
let successHandler;
let failureHandler;
const runner = {
  withSuccessHandler(handler) { successHandler = handler; return this; },
  withFailureHandler(handler) { failureHandler = handler; return this; },
  getBookingOptions(arg) { calls.push({ method: 'getBookingOptions', arg, successHandler, failureHandler }); },
  getAvailability(arg) { calls.push({ method: 'getAvailability', arg, successHandler, failureHandler }); },
  createBooking(arg) { calls.push({ method: 'createBooking', arg, successHandler, failureHandler }); }
};
let uuidCount = 0;
const context = {
  Date, Uint8Array,
  crypto: { randomUUID() { uuidCount += 1; return `00000000-0000-4000-8000-00000000000${uuidCount}`; } },
  Intl: { DateTimeFormat: function (locale, options) {
    return { format(value) { return `${options.timeZone}:${value.toISOString()}`; } };
  } },
  window: { confirm() { return true; } },
  document: {
    getElementById(id) { return elements[id]; },
    createElement() { return new Element(); }
  },
  google: { script: { run: runner } }
};
vm.createContext(context);
const source = fs.readFileSync('apps-script-customer/Booking.html', 'utf8')
  .split('<script>')[1].split('</script>')[0];
assert.match(source, /crypto\.getRandomValues/);
assert.doesNotMatch(source, /Math\.random/);
vm.runInContext(source, context);

assert.equal(calls[0].method, 'getBookingOptions');
calls[0].successHandler({
  ok: true, timezone: 'Asia/Tokyo', storeLocalDate: '2030-01-02', bookingHorizonEndDate: '2030-03-03',
  services: [{ id: 'standard', name: 'ご予約' }]
});
assert.equal(elements.date.min, '2030-01-02', 'date minimum comes from the server');
assert.equal(elements.date.max, '2030-03-03', 'date maximum comes from the server');

elements.service.value = 'standard';
elements.date.value = '2030-01-02';
elements.date.onchange();
calls.at(-1).successHandler({
  ok: true, slots: [{ start: '2030-01-02T00:00:00.000Z', end: '2030-01-02T01:00:00.000Z' }]
});
assert.equal(elements.times.children[0].textContent, 'Asia/Tokyo:2030-01-02T00:00:00.000Z',
  'slot display uses the configured store timezone');
elements.times.children[0].onclick();
elements.name.value = '山田 太郎';

elements.confirm.onclick();
const firstAttempt = calls.at(-1);
assert.equal(firstAttempt.method, 'createBooking');
firstAttempt.failureHandler(new Error('ambiguous transport failure'));
elements.confirm.onclick();
const retry = calls.at(-1);
assert.equal(retry.arg.requestId, firstAttempt.arg.requestId, 'ambiguous retry retains requestId');
assert.equal(uuidCount, 1);

retry.successHandler({ ok: false, error: { code: 'UNAVAILABLE', message: '予約を確定できませんでした' } });
elements.confirm.onclick();
const afterDefinitiveResult = calls.at(-1);
assert.notEqual(afterDefinitiveResult.arg.requestId, retry.arg.requestId, 'definitive server result clears requestId');
assert.equal(uuidCount, 2);

console.log('customer booking client tests passed');
