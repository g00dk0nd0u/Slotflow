const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Element {
  constructor() { this.children = []; this._text = ''; this._html = ''; this.value = ''; this.disabled = false; this.className = ''; this.attributes = {}; }
  appendChild(child) { this.children.push(child); return child; }
  set textContent(value) { this._text = String(value); this._html = ''; this.children = []; }
  get textContent() { return this._text; }
  set innerHTML(value) { this._html = String(value); this._text = ''; this.children = []; }
  get innerHTML() { return this._html; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
}

const ids = ['service', 'days', 'month', 'ranges', 'selectedDate', 'error', 'previous', 'next', 'phone', 'store'];
const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
const calls = [];
let successHandler;
let failureHandler;
const runner = {
  withSuccessHandler(handler) { successHandler = handler; return this; },
  withFailureHandler(handler) { failureHandler = handler; return this; },
  getAvailabilityOptions(arg) { calls.push({ method: 'getAvailabilityOptions', arg, successHandler, failureHandler }); },
  getAvailability(arg) { calls.push({ method: 'getAvailability', arg, successHandler, failureHandler }); }
};
const context = {
  Date,
  document: {
    getElementById(id) { return elements[id]; },
    createElement() { return new Element(); }
  },
  google: { script: { run: runner } }
};
vm.createContext(context);
const html = fs.readFileSync('apps-script-customer/Availability.html', 'utf8');
const source = html.split('<script>')[1].split('</script>')[0];
vm.runInContext(source, context);

calls[0].successHandler({
  ok: true, storeName: 'Slotflow Salon', phoneHref: 'tel:+81312345678', timezone: 'Asia/Tokyo',
  storeLocalDate: '2030-01-01', availabilityHorizonEndDate: '2030-03-02',
  services: [{ id: 'standard', name: 'カット', durationMinutes: 60 }, { id: 'short', name: '前髪', durationMinutes: 30 }]
});
assert.equal(elements.store.textContent, 'Slotflow Salon');
assert.equal(source.includes("textContent=response.timezone"), false, 'raw IANA timezone is not displayed');

function respondWith(date, ranges = ['10:30 ～ 11:00']) {
  calls.at(-1).successHandler({ ok: true, serviceId: elements.service.value, days: [{ date, status: '△', ranges }] });
  const button = elements.days.children.find((item) => item.attributes['aria-label']?.startsWith(date));
  assert.ok(button, `date button ${date} exists`);
  button.onclick();
}

respondWith('2030-01-02');
assert.equal(elements.selectedDate.textContent, '1月2日（水）', 'date is formatted from date components without device timezone');
assert.equal(elements.ranges.children[0].textContent, '10:30 ～ 11:00');

elements.service.value = 'short';
elements.service.onchange();
assert.equal(elements.selectedDate.textContent, '日付を選択してください', 'service change clears the old date immediately');
assert.match(elements.ranges.innerHTML, /カレンダーから日付を選択してください/, 'service change clears old ranges immediately');
const staleServiceCall = calls.at(-1);
staleServiceCall.successHandler({ ok: true, serviceId: 'short', days: [{ date: '2030-01-03', status: '△', ranges: ['12:00 ～ 12:30'] }] });
respondWith('2030-01-03');

elements.next.onclick();
assert.equal(elements.selectedDate.textContent, '日付を選択してください', 'month change clears the old date immediately');
assert.match(elements.ranges.innerHTML, /カレンダーから日付を選択してください/, 'month change clears old ranges immediately');
respondWith('2030-02-01');

elements.service.value = 'standard';
elements.service.onchange();
const failedCall = calls.at(-1);
failedCall.failureHandler(new Error('provider unavailable'));
assert.equal(elements.selectedDate.textContent, '日付を選択してください');
assert.match(elements.ranges.innerHTML, /表示できません/, 'provider failure never leaves old ranges visible');

const obsolete = failedCall;
elements.service.value = 'short';
elements.service.onchange();
obsolete.successHandler({ ok: true, serviceId: 'standard', days: [{ date: '2030-02-02', status: '○', ranges: ['09:00 ～ 10:00'] }] });
assert.equal(elements.days.textContent, '読み込み中…', 'stale availability response remains ignored');

assert.match(source, /response\.phoneHref/);
assert.match(html, /電話で確認する/);
['create' + 'Booking', 'request' + 'Id', 'finger' + 'print', 'お名' + '前', '連絡' + '先', '予約を' + '確定',
  'Calendar.Events.' + 'insert', 'Lock' + 'Service'].forEach((term) => {
  assert.equal(source.includes(term), false, `write-only term remains: ${term}`);
});
console.log('customer availability client tests passed');
