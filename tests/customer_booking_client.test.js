const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Element {
  constructor() { this.children = []; this._text = ''; this.value = ''; this.disabled = false; this.hidden = false; this.className = ''; }
  appendChild(child) { this.children.push(child); return child; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(''); }
}

const ids = ['service', 'date', 'times', 'name', 'contact', 'confirm', 'result'];
const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
elements.service.value = 'standard';
elements.date.value = '2030-01-02';
elements.name.value = '山田 太郎';

const calls = [];
let successHandler;
let failureHandler;
const runner = {
  withSuccessHandler(handler) { successHandler = handler; return this; },
  withFailureHandler(handler) { failureHandler = handler; return this; },
  getBookingOptions(argument) { calls.push({ method: 'getBookingOptions', argument, successHandler, failureHandler }); },
  getAvailability(argument) { calls.push({ method: 'getAvailability', argument, successHandler, failureHandler }); },
  createBooking(argument) { calls.push({ method: 'createBooking', argument, successHandler, failureHandler }); }
};
let uuid = 0;
const context = {
  Date, Intl, Uint8Array,
  crypto: { randomUUID() { uuid += 1; return `00000000-0000-4000-8000-00000000000${uuid}`; } },
  document: {
    getElementById(id) { return elements[id]; },
    createElement() { return new Element(); }
  },
  google: { script: { run: runner } },
  window: { confirm() { return true; } }
};
vm.createContext(context);
const source = fs.readFileSync('apps-script-customer/Booking.html', 'utf8').split('<script>')[1].split('</script>')[0];
vm.runInContext(source, context);

calls[0].successHandler({
  ok: true, timezone: 'Asia/Tokyo', storeLocalDate: '2030-01-01', bookingHorizonEndDate: '2030-03-02',
  services: [{ id: 'standard', name: 'ご予約' }]
});
assert.equal(elements.date.min, '2030-01-01', 'date minimum comes from the store-local server value');
assert.equal(elements.date.max, '2030-03-02', 'date maximum comes from the server booking horizon');

elements.date.onchange();
calls[1].successHandler({ ok: true, slots: [{ start: '2030-01-02T00:00:00.000Z', end: '2030-01-02T01:00:00.000Z' }] });
assert.match(elements.times.children[0].textContent, /09:00/, 'slot label uses Asia/Tokyo rather than the device timezone');
elements.times.children[0].onclick();
elements.confirm.onclick();
const first = calls[2];
first.failureHandler(new Error('ambiguous transport failure'));
elements.confirm.onclick();
const retry = calls[3];
assert.equal(retry.argument.requestId, first.argument.requestId, 'ambiguous retry retains its requestId');

retry.successHandler({ ok: false, error: { code: 'SLOT_UNAVAILABLE', message: '競合しました' } });
elements.confirm.onclick();
assert.notEqual(calls[4].argument.requestId, first.argument.requestId, 'definitive response clears the requestId');
console.log('customer booking client tests passed');
