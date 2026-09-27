const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Element {
  constructor() { this.children = []; this._text = ''; this._html = ''; this.value = ''; this.disabled = false; this.hidden = false; this.className = ''; this.attributes = {}; }
  appendChild(child) { this.children.push(child); return child; }
  set textContent(value) { this._text = String(value); this._html = ''; this.children = []; }
  get textContent() { return this._text; }
  set innerHTML(value) { this._html = String(value); this._text = ''; this.children = []; }
  get innerHTML() { return this._html; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
}

const ids = ['service', 'option', 'months', 'ranges', 'selectedDate', 'error', 'phone', 'store'];
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
  services: [{ id: 'standard', name: 'カット' }, { id: 'color', name: 'カラー', options: [{ id: 'short', name: 'ショート' }, { id: 'long', name: 'ロング' }] }]
});
assert.equal(elements.store.textContent, 'Slotflow Salon', 'store name remains data-driven');
assert.equal(source.includes('textContent=response.timezone'), false, 'raw IANA timezone is not displayed');
assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1).arg)), { startDate: '2030-01-01', endDate: '2030-02-09', serviceId: 'standard' },
  'six-week view starts on Sunday while excluding past dates from the request');

function allDateButtons() {
  return elements.months.children.flatMap((month) => month.children[2].children)
    .filter((item) => item.attributes['aria-label']);
}

function respondWith(days) {
  calls.at(-1).successHandler({ ok: true, serviceId: elements.service.value, days });
}

respondWith([
  { date: '2030-01-02', status: '△', ranges: ['10:30 ～ 11:00'] },
  { date: '2030-01-03', status: '○', ranges: ['13:00 ～ 15:30', '17:00 ～ 17:30'] }
]);
assert.deepEqual(elements.months.children.map((group) => group.children[0].textContent), ['2029年12月', '2030年1月', '2030年2月'],
  '42 consecutive days are grouped under data-driven month headings across year and month boundaries');
assert.deepEqual(elements.months.children[0].children[1].children.map((item) => item.textContent), ['日', '月', '火', '水', '木', '金', '土'],
  'weekday headers are Sunday-first');
assert.equal(allDateButtons().length, 42, 'six full weeks are rendered immediately');
const pastDate = allDateButtons().find((item) => item.attributes['aria-label'].startsWith('2029-12-31'));
assert.ok(pastDate && pastDate.disabled, 'past dates remain visible and disabled');
assert.equal(html.includes('id="expand"'), false, 'the expansion control is absent');
assert.equal(html.includes('.expand'), false, 'expansion styling is absent');
const dateButton = allDateButtons().find((item) => item.attributes['aria-label'].startsWith('2030-01-02'));
assert.ok(dateButton, 'available date button exists');
dateButton.onclick();
assert.equal(elements.selectedDate.textContent, '1月2日（水）', 'selected date uses Japanese local date formatting');
assert.match(allDateButtons().find((item) => item.attributes['aria-label'].startsWith('2030-01-02')).className, /selected/,
  'selected date receives the highlight class');
assert.equal(elements.ranges.children[0].textContent, '10:30 ～ 11:00');

elements.service.value = 'color';
elements.service.onchange();
assert.equal(elements.selectedDate.textContent, '日付を選択してください', 'service change clears the old date immediately');
assert.match(elements.ranges.innerHTML, /カレンダーから日付を選択してください/, 'service change clears old ranges immediately');
assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1).arg)), { startDate: '2030-01-01', endDate: '2030-02-09', serviceId: 'color', optionId: 'short' },
  'service change reloads the same six-week window');
assert.deepEqual(elements.option.children.map((item) => item.textContent), ['ショート', 'ロング'],
  'options are populated from the selected service');
const staleServiceCall = calls.at(-1);

elements.option.value = 'long';
elements.option.onchange();
assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1).arg)), { startDate: '2030-01-01', endDate: '2030-02-09', serviceId: 'color', optionId: 'long' },
  'option change clears and reloads availability with no client duration');
assert.equal(elements.selectedDate.textContent, '日付を選択してください');

elements.service.value = 'standard';
elements.service.onchange();
staleServiceCall.successHandler({ ok: true, serviceId: 'color', optionId: 'short', days: [{ date: '2030-01-03', status: '△', ranges: ['12:00 ～ 12:30'] }] });
assert.equal(elements.months.textContent, '読み込み中…', 'stale service response remains ignored');
const failedCall = calls.at(-1);
failedCall.failureHandler(new Error('provider unavailable'));
assert.equal(elements.selectedDate.textContent, '日付を選択してください');
assert.match(elements.ranges.innerHTML, /表示できません/, 'provider failure never leaves old ranges visible');

assert.equal(elements.phone.attributes['aria-disabled'], 'false');
assert.equal(elements.phone.href, 'tel:+81312345678', 'phone CTA preserves the server-provided tel link');
assert.match(html, /電話で確認する/);
assert.match(html, /※ 表示の時間内でも、施術内容によりご案内できない場合があります。/);

assert.equal(html.includes('空き状況カレンダー'), false);
function initialRequestFor(storeLocalDate) {
  const localElements = Object.fromEntries(ids.map((id) => [id, new Element()]));
  const localCalls = [];
  let success;
  const localRunner = {
    withSuccessHandler(handler) { success = handler; return this; },
    withFailureHandler() { return this; },
    getAvailabilityOptions(arg) { localCalls.push({ method: 'getAvailabilityOptions', arg, success }); },
    getAvailability(arg) { localCalls.push({ method: 'getAvailability', arg }); }
  };
  const localContext = { Date, document: {
    getElementById(id) { return localElements[id]; }, createElement() { return new Element(); }
  }, google: { script: { run: localRunner } } };
  vm.createContext(localContext);
  vm.runInContext(source, localContext);
  localCalls[0].success({ ok: true, storeName: '店', phoneHref: 'tel:1', timezone: 'Asia/Tokyo',
    storeLocalDate, availabilityHorizonEndDate: '2031-12-31', services: [{ id: 'standard', name: 'カット' }] });
  return JSON.parse(JSON.stringify(localCalls.at(-1).arg));
}
assert.deepEqual(initialRequestFor('2030-06-09'), { startDate: '2030-06-09', endDate: '2030-07-20', serviceId: 'standard' },
  'a Sunday anchors to itself across a month boundary');
assert.deepEqual(initialRequestFor('2030-06-10'), { startDate: '2030-06-10', endDate: '2030-07-20', serviceId: 'standard' },
  'a Monday anchors to the preceding Sunday without requesting it');
assert.deepEqual(initialRequestFor('2031-01-01'), { startDate: '2031-01-01', endDate: '2031-02-08', serviceId: 'standard' },
  'the Sunday calculation crosses a year boundary');
['create' + 'Booking', 'request' + 'Id', 'finger' + 'print', 'お名' + '前', '連絡' + '先', '予約を' + '確定',
  'Calendar.Events.' + 'insert', 'Lock' + 'Service'].forEach((term) => {
  assert.equal(source.includes(term), false, `write-only term remains: ${term}`);
});
console.log('customer availability client tests passed');
