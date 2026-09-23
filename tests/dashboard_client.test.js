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

function event(title, start, end) {
  return { id: title, title, start, end, allDay: false, busy: true };
}

function payload(options = {}) {
  const timedEvents = options.timedEvents || [];
  return {
    ok: true,
    generatedAt: options.generatedAt || '2030-01-01T08:00:00.000Z',
    timezone: options.timezone || 'Asia/Tokyo',
    storeLocalDate: options.storeLocalDate || '2030-01-01',
    today: {
      allDayEvents: [], timedEvents,
      currentOrNextEvent: options.currentOrNextEvent === undefined ? (timedEvents[0] || null) : options.currentOrNextEvent,
      freeGaps: options.freeGaps || []
    },
    upcomingEvents: options.upcomingEvents || []
  };
}

const source = fs.readFileSync('apps-script/DashboardClient.html', 'utf8')
  .replace(/^\s*<script>\s*/, '').replace(/\s*<\/script>\s*$/, '');

function harness(cache, initialNow = '2030-01-01T09:00:00.000Z') {
  const ids = ['store-date','store-clock','status','last-updated','refresh','hero-label','hero-time','hero-title','hero-date','all-day','events','gaps','next-gap'];
  const elements = Object.fromEntries(ids.map((id) => [id, new Element()]));
  let success;
  let failure;
  let calls = 0;
  let now = Date.parse(initialNow);
  const intervals = [];
  const storage = new Map(cache ? [['slotflow.dashboard.schedule.v1', JSON.stringify(cache)]] : []);
  class FakeDate extends Date {
    constructor(value) { super(value === undefined ? now : value); }
    static now() { return now; }
  }
  const runner = {
    withSuccessHandler(handler) { success = handler; return this; },
    withFailureHandler(handler) { failure = handler; return this; },
    getDashboardSchedule() { calls += 1; }
  };
  const context = {
    console, Date: FakeDate, Intl,
    document: {
      readyState: 'loading', hidden: false,
      createElement() { return new Element(); },
      getElementById(id) { return elements[id]; },
      addEventListener() {}
    },
    localStorage: { getItem(key) { return storage.get(key) || null; }, setItem(key, value) { storage.set(key, value); } },
    google: { script: { run: runner } },
    setInterval(callback, delay) { intervals.push({ callback, delay }); }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  context.SlotflowDashboard.init();
  return {
    context, elements, storage,
    calls: () => calls,
    succeed(value) { success(value); },
    fail() { failure(new Error('provider unavailable')); },
    setNow(value) { now = Date.parse(value); },
    tickClock() { intervals.find((item) => item.delay === 1000).callback(); }
  };
}

const cachedEvent = event('<img src=x onerror=alert(1)>', '2030-01-01T10:00:00.000Z', '2030-01-01T11:00:00.000Z');
const sameDay = harness(payload({ timedEvents: [cachedEvent] }));
assert.equal(sameDay.elements['hero-title'].textContent, cachedEvent.title, 'same-day cache renders immediately');
assert.equal(sameDay.elements.status.textContent, '更新中・保存データ');
assert.equal(sameDay.elements['hero-time'].textContent, '19:00–20:00', 'store timezone controls display');
assert.equal(sameDay.elements['hero-title'].children.length, 0, 'HTML-like title remains text');
assert.equal(sameDay.calls(), 1);
assert.equal(sameDay.context.SlotflowDashboard.refresh(), false, 'overlapping refresh is prevented');

sameDay.succeed(payload({ timedEvents: [event('新しい予定', '2030-01-01T11:00:00Z', '2030-01-01T12:00:00Z')] }));
assert.equal(sameDay.elements['hero-title'].textContent, '新しい予定');
assert.equal(sameDay.elements.status.textContent, '最新');
assert.equal(sameDay.context.SlotflowDashboard.refresh(), true);
sameDay.fail();
assert.equal(sameDay.elements['hero-title'].textContent, '新しい予定', 'same-day data survives refresh failure');
assert.equal(sameDay.elements.status.textContent, '更新失敗・保存データ');

const priorDay = harness(payload({ storeLocalDate: '2029-12-31', timedEvents: [event('昨日の予定', '2029-12-31T10:00:00Z', '2029-12-31T11:00:00Z')] }));
assert.notEqual(priorDay.elements['hero-title'].textContent, '昨日の予定', 'prior-day cache is not rendered');
assert.equal(priorDay.elements.status.textContent, '更新中');
priorDay.fail();
assert.equal(priorDay.elements['hero-title'].textContent, '最新情報を取得できません');
assert.equal(priorDay.elements.status.textContent, '最新情報を取得できません');
assert.ok(priorDay.storage.has('slotflow.dashboard.schedule.v1'), 'prior-day cache is retained');

const ended = event('終了済み', '2030-01-01T07:00:00Z', '2030-01-01T08:00:00Z');
const later = event('後の予定', '2030-01-01T10:00:00Z', '2030-01-01T11:00:00Z');
const agedFocus = harness(payload({ timedEvents: [ended], currentOrNextEvent: ended, upcomingEvents: [later] }));
assert.equal(agedFocus.elements['hero-title'].textContent, '後の予定', 'ended cached focus is replaced by a later event');
assert.equal(agedFocus.elements['hero-label'].textContent, '次の予定');

const ongoing = event('進行中の予定', '2030-01-01T08:30:00Z', '2030-01-01T09:30:00Z');
const current = harness(payload({ timedEvents: [ongoing] }));
assert.equal(current.elements['hero-title'].textContent, '進行中の予定');
assert.equal(current.elements['hero-label'].textContent, '現在の予定');

const noRemaining = harness(payload({ timedEvents: [ended], currentOrNextEvent: ended }));
assert.equal(noRemaining.elements['hero-title'].textContent, '今後の予定はありません');

const empty = harness();
empty.succeed(payload());
assert.equal(empty.elements.events.textContent, '本日の予定はありません', 'valid empty schedule is not a failure');
assert.equal(empty.elements.status.textContent, '最新');

const beforeMidnight = event('閉店前の予定', '2030-01-01T14:59:30Z', '2030-01-01T15:30:00Z');
const rollover = harness(payload({ timedEvents: [beforeMidnight] }), '2030-01-01T14:59:00Z');
assert.equal(rollover.elements['hero-title'].textContent, '閉店前の予定');
rollover.setNow('2030-01-01T15:01:00Z'); // 00:01 on January 2 in Asia/Tokyo.
rollover.tickClock();
assert.equal(rollover.elements['hero-title'].textContent, '最新情報を取得できません', 'store-local midnight clears prior-day schedule');
assert.equal(rollover.context.SlotflowDashboard.storeDate(new rollover.context.Date(), 'America/Los_Angeles'), '2030-01-01',
  'store date is independent of the test runner/device timezone');

console.log('dashboard client tests passed');
