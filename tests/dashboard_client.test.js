const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Element {
  constructor() { this.children = []; this._text = ''; this.className = ''; this.hidden = false; this.disabled = false; }
  appendChild(child) { this.children.push(child); return child; }
  removeChild() { return this.children.shift(); }
  get firstChild() { return this.children[0] || null; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map((child) => child.textContent).join(''); }
  addEventListener() {}
}

function payload(title = '<img src=x onerror=alert(1)>', events = true) {
  const event = { id: 'one', title, start: '2030-01-01T10:00:00.000Z', end: '2030-01-01T11:00:00.000Z', allDay: false, busy: true };
  return {
    ok: true, generatedAt: '2030-01-01T09:00:00.000Z', timezone: 'Asia/Tokyo', storeLocalDate: '2030-01-01',
    today: { allDayEvents: [], timedEvents: events ? [event] : [], currentOrNextEvent: events ? event : null,
      freeGaps: events ? [{ start: '2030-01-01T08:00:00.000Z', end: '2030-01-01T10:00:00.000Z' }] : [] },
    upcomingEvents: []
  };
}

const ids = ['store-date','store-clock','status','last-updated','refresh','hero-label','hero-time','hero-title','hero-date','all-day','events','gaps','next-gap'];
const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
let success;
let failed;
let calls = 0;
const storage = new Map([['slotflow.dashboard.schedule.v1', JSON.stringify(payload())]]);
const runner = {
  withSuccessHandler(handler) { success = handler; return this; },
  withFailureHandler(handler) { failed = handler; return this; },
  getDashboardSchedule() { calls += 1; }
};
const context = {
  console, Date, Intl,
  document: {
    readyState: 'loading', hidden: false,
    createElement() { return new Element(); },
    getElementById(id) { return elements[id]; },
    addEventListener() {}
  },
  localStorage: { getItem(key) { return storage.get(key) || null; }, setItem(key, value) { storage.set(key, value); } },
  google: { script: { run: runner } },
  setInterval() {}
};
vm.createContext(context);
const source = fs.readFileSync('apps-script/DashboardClient.html', 'utf8')
  .replace(/^\s*<script>\s*/, '').replace(/\s*<\/script>\s*$/, '');
vm.runInContext(source, context);
context.SlotflowDashboard.init();

assert.equal(elements['hero-title'].textContent, '<img src=x onerror=alert(1)>', 'cached payload renders before live response');
assert.equal(elements.status.textContent, '更新中・保存データ', 'cached data is marked non-live while refreshing');
assert.equal(elements['hero-time'].textContent, '19:00–20:00', 'times use Asia/Tokyo rather than the device timezone');
assert.equal(elements['hero-title'].children.length, 0, 'HTML-like title is assigned as text, not markup');
assert.equal(calls, 1);
assert.equal(context.SlotflowDashboard.refresh(), false, 'overlapping refresh is prevented');
assert.equal(calls, 1);

success(payload('新しい予定'));
assert.equal(elements['hero-title'].textContent, '新しい予定', 'live response replaces cached display');
assert.equal(elements.status.textContent, '最新');
assert.equal(JSON.parse(storage.get('slotflow.dashboard.schedule.v1')).today.timedEvents[0].title, '新しい予定');

assert.equal(context.SlotflowDashboard.refresh(), true);
failed(new Error('offline'));
assert.equal(elements['hero-title'].textContent, '新しい予定', 'failure keeps previous successful data');
assert.equal(elements.status.textContent, 'オフライン・保存データ');
assert.equal(JSON.parse(storage.get('slotflow.dashboard.schedule.v1')).today.timedEvents[0].title, '新しい予定');

assert.equal(context.SlotflowDashboard.refresh(), true);
success(payload('', false));
assert.equal(elements.events.textContent, '本日の予定はありません', 'valid empty schedule is not a failure');
assert.equal(elements.status.textContent, '最新');
console.log('dashboard client tests passed');
