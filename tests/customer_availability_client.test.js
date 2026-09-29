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

const ids = ['service', 'option', 'months', 'ranges', 'selectedDate', 'error', 'phone', 'store', 'expand', 'expandLabel'];
const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
elements.expand.hidden = true;
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
assert.equal(elements.expand.hidden, true, 'expand control is hidden before availability options finish loading');
assert.match(html, /\.expand\[hidden\]\{display:none\}/, 'hidden expand control overrides its flex display rule');

calls[0].successHandler({
  ok: true, storeName: 'Slotflow Salon', phoneHref: 'tel:+81312345678', timezone: 'Asia/Tokyo',
  storeLocalDate: '2030-01-01', availabilityHorizonEndDate: '2030-03-02',
  services: [{ id: 'standard', name: 'カット' }, { id: 'color', name: 'カラー', options: [{ id: 'short', name: 'ショート' }, { id: 'long', name: 'ロング' }] }]
});
assert.equal(elements.store.textContent, 'Slotflow Salon', 'store name remains data-driven');
assert.equal(source.includes('textContent=response.timezone'), false, 'raw IANA timezone is not displayed');
assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1).arg)), { startDate: '2030-01-01', endDate: '2030-02-09', serviceId: 'standard' },
  'six-week view starts on Sunday while excluding past dates from the request');
assert.equal(elements.expand.hidden, true, 'expand control stays hidden while initial availability is loading');

function allDateButtons() {
  return elements.months.children.flatMap((period) => period.children)
    .flatMap((month) => month.children.find((child) => child.className === 'days').children)
    .filter((item) => item.attributes['aria-label']);
}

function monthHeadings(calendarElements) {
  return calendarElements.months.children.flatMap((period) => period.children)
    .flatMap((month) => month.children.filter((child) => child.className === 'month-title'))
    .map((heading) => heading.textContent);
}

function respondWith(days) {
  calls.at(-1).successHandler({ ok: true, serviceId: elements.service.value, days });
}

respondWith([
  { date: '2030-01-02', status: '△', ranges: ['10:30 ～ 11:00'] },
  { date: '2030-01-03', status: '○', ranges: ['13:00 ～ 15:30', '17:00 ～ 17:30'] },
  { date: '2030-01-22', status: '○', ranges: ['11:00 ～ 12:00'] }
]);
assert.equal(elements.months.children[0].hidden, false, 'the first three weeks are visible initially');
assert.equal(elements.months.children[1].hidden, true, 'the later three weeks are hidden initially');
assert.equal(elements.months.children[0].children.flatMap((month) => month.children.find((child) => child.className === 'days').children)
  .filter((item) => item.attributes['aria-label']).length, 21, 'the initial calendar contains exactly three weeks');
assert.deepEqual(monthHeadings(elements), ['2029年12月', '2030年1月', '2030年2月'],
  'a split within January does not repeat its month heading');
assert.equal(elements.months.children[1].children[0].children.filter((child) => child.className === 'week').length, 0,
  'a split within a month does not repeat its weekday header');
assert.deepEqual(elements.months.children[0].children[0].children[1].children.map((item) => item.textContent), ['日', '月', '火', '水', '木', '金', '土'],
  'weekday headers are Sunday-first');
assert.equal(allDateButtons().length, 42, 'all six weeks remain rendered and available client-side');
const pastDate = allDateButtons().find((item) => item.attributes['aria-label'].startsWith('2029-12-31'));
assert.ok(pastDate && pastDate.disabled, 'past dates remain visible and disabled');
assert.equal(elements.expandLabel.textContent, 'もっと見る');
assert.equal(elements.expand.hidden, false, 'successful availability load shows the expand control');
assert.equal(elements.expand.attributes['aria-expanded'], 'false');
elements.expand.onclick();
assert.equal(elements.months.children[1].hidden, false, 'the later three weeks appear after expansion');
assert.equal(elements.expandLabel.textContent, '閉じる');
assert.equal(elements.expand.attributes['aria-expanded'], 'true');
const laterDateButton = allDateButtons().find((item) => item.attributes['aria-label'].startsWith('2030-01-22'));
assert.ok(laterDateButton, 'a date in the expanded period is available');
laterDateButton.onclick();
assert.equal(elements.selectedDate.textContent, '1月22日（火）');
assert.equal(elements.ranges.children[0].textContent, '11:00 ～ 12:00');
elements.expand.onclick();
assert.equal(elements.months.children[1].hidden, true, 'the later three weeks can be collapsed again');
assert.equal(elements.expandLabel.textContent, 'もっと見る');
assert.equal(elements.selectedDate.textContent, '1月22日（火）', 'collapsing preserves the selected date and its startable times');
elements.expand.onclick();
assert.match(allDateButtons().find((item) => item.attributes['aria-label'].startsWith('2030-01-22')).className, /selected/,
  'the selected date remains highlighted after re-expansion');
assert.deepEqual(monthHeadings(elements), ['2029年12月', '2030年1月', '2030年2月'],
  'collapse and re-expansion do not restore the duplicate month heading');
elements.expand.onclick();
const dateButton = allDateButtons().find((item) => item.attributes['aria-label'].startsWith('2030-01-02'));
assert.ok(dateButton, 'available date button exists');
dateButton.onclick();
assert.equal(elements.selectedDate.textContent, '1月2日（水）', 'selected date uses Japanese local date formatting');
assert.match(allDateButtons().find((item) => item.attributes['aria-label'].startsWith('2030-01-02')).className, /selected/,
  'selected date receives the highlight class');
assert.equal(elements.ranges.children[0].textContent, '10:30 ～ 11:00');

elements.service.value = 'color';
elements.service.onchange();
assert.equal(elements.expand.hidden, true, 'expand control stays hidden while service availability reloads');
assert.equal(elements.selectedDate.textContent, '日付を選択してください', 'service change clears the old date immediately');
assert.match(elements.ranges.innerHTML, /カレンダーから日付を選択してください/, 'service change clears old ranges immediately');
assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1).arg)), { startDate: '2030-01-01', endDate: '2030-02-09', serviceId: 'color', optionId: 'short' },
  'service change reloads the same six-week window');
assert.deepEqual(elements.option.children.map((item) => item.textContent), ['ショート', 'ロング'],
  'options are populated from the selected service');
const staleOptionCall = calls.at(-1);

elements.option.value = 'long';
elements.option.onchange();
assert.equal(elements.expand.hidden, true, 'expand control stays hidden while option availability reloads');
const latestOptionCall = calls.at(-1);
assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1).arg)), { startDate: '2030-01-01', endDate: '2030-02-09', serviceId: 'color', optionId: 'long' },
  'option change clears and reloads availability with no client duration');
assert.equal(elements.selectedDate.textContent, '日付を選択してください');
staleOptionCall.successHandler({ ok: true, serviceId: 'color', optionId: 'short', days: [
  { date: '2030-01-03', status: '△', ranges: ['12:00 ～ 12:30'] }
] });
assert.equal(elements.months.textContent, '読み込み中…',
  'an older response for another option cannot overwrite the latest option selection');
latestOptionCall.successHandler({ ok: true, serviceId: 'color', optionId: 'long', days: [
  { date: '2030-01-04', status: '○', ranges: ['14:00 ～ 15:00'] }
] });
assert.ok(allDateButtons().find((item) => item.attributes['aria-label'] === '2030-01-04 ○'),
  'the latest option response is rendered');
assert.equal(elements.expand.hidden, false, 'successful reload shows the expand control again');

elements.service.value = 'standard';
elements.service.onchange();
assert.equal(elements.expand.hidden, true, 'expand control is hidden for the next service reload');
staleOptionCall.successHandler({ ok: true, serviceId: 'color', optionId: 'short', days: [{ date: '2030-01-03', status: '△', ranges: ['12:00 ～ 12:30'] }] });
assert.equal(elements.months.textContent, '読み込み中…', 'stale service response remains ignored');
const failedCall = calls.at(-1);
failedCall.failureHandler(new Error('provider unavailable'));
assert.equal(elements.expand.hidden, true, 'expand control stays hidden after provider failure handling');
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

function headingsFor(storeLocalDate) {
  const localElements = Object.fromEntries(ids.map((id) => [id, new Element()]));
  const localCalls = [];
  let success;
  const localRunner = {
    withSuccessHandler(handler) { success = handler; return this; },
    withFailureHandler() { return this; },
    getAvailabilityOptions(arg) { localCalls.push({ method: 'getAvailabilityOptions', arg, success }); },
    getAvailability(arg) { localCalls.push({ method: 'getAvailability', arg, success }); }
  };
  const localContext = { Date, document: {
    getElementById(id) { return localElements[id]; }, createElement() { return new Element(); }
  }, google: { script: { run: localRunner } } };
  vm.createContext(localContext);
  vm.runInContext(source, localContext);
  localCalls[0].success({ ok: true, storeName: '店', phoneHref: 'tel:1', timezone: 'Asia/Tokyo',
    storeLocalDate, availabilityHorizonEndDate: '2031-12-31', services: [{ id: 'standard', name: 'カット' }] });
  localCalls.at(-1).success({ ok: true, serviceId: 'standard', days: [] });
  return monthHeadings(localElements);
}
assert.deepEqual(headingsFor('2030-08-11'), ['2030年8月', '2030年9月'],
  'a split exactly on the September boundary keeps the new month heading');
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
