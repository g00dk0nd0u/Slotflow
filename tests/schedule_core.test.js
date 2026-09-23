const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = { Date };
vm.createContext(context);
vm.runInContext(fs.readFileSync('apps-script/ScheduleCore.gs', 'utf8'), context);
const core = context.ScheduleCore;

function timed(overrides = {}) {
  return core.normalizeEvent(Object.assign({
    id: 'event-1', summary: 'Appointment', status: 'confirmed', transparency: 'opaque',
    start: { dateTime: '2026-09-23T01:00:00Z' }, end: { dateTime: '2026-09-23T02:00:00Z' }
  }, overrides));
}

assert.deepEqual(JSON.parse(JSON.stringify(timed())), {
  id: 'event-1', title: 'Appointment', start: '2026-09-23T01:00:00.000Z',
  end: '2026-09-23T02:00:00.000Z', allDay: false, busy: true
});
assert.equal(timed({ transparency: 'transparent' }).busy, false);
assert.equal(timed({ status: 'cancelled' }).busy, false);

const oneDay = core.normalizeEvent({ id: 'closed', summary: 'Closed', start: { date: '2026-09-23' }, end: { date: '2026-09-24' } });
const multiDay = core.normalizeEvent({ id: 'holiday', start: { date: '2026-09-22' }, end: { date: '2026-09-25' } });
assert.equal(oneDay.allDay, true);
assert.equal(multiDay.end, '2026-09-25');
assert.equal(core.derive([oneDay], '2026-09-23T00:00:00Z', '2026-09-23',
  { start: '2026-09-23T00:00:00Z', end: '2026-09-24T00:00:00Z' },
  [{ start: '2026-09-23T00:00:00Z', end: '2026-09-23T06:00:00Z' }]).freeGaps.length, 0);

const merged = core.mergeIntervals([
  { start: '2026-09-23T01:00:00Z', end: '2026-09-23T03:00:00Z' },
  { start: '2026-09-23T02:00:00Z', end: '2026-09-23T04:00:00Z' },
  { start: '2026-09-23T04:00:00Z', end: '2026-09-23T05:00:00Z' }
]);
assert.equal(merged.length, 1, 'overlapping and adjacent intervals merge');

const gaps = core.freeGaps(
  { start: '2026-09-23T00:00:00Z', end: '2026-09-23T06:00:00Z' },
  [{ start: '2026-09-23T01:00:00Z', end: '2026-09-23T02:00:00Z' }, { start: '2026-09-23T02:00:00Z', end: '2026-09-23T03:00:00Z' }]
);
assert.deepEqual(JSON.parse(JSON.stringify(gaps)), [
  { start: '2026-09-23T00:00:00.000Z', end: '2026-09-23T01:00:00.000Z' },
  { start: '2026-09-23T03:00:00.000Z', end: '2026-09-23T06:00:00.000Z' }
]);
const nonBlocking = core.derive([
  timed({ transparency: 'transparent' }),
  timed({ id: 'cancelled', status: 'cancelled' })
], '2026-09-23T00:00:00Z', '2026-09-23',
{ start: '2026-09-23T00:00:00Z', end: '2026-09-24T00:00:00Z' },
[{ start: '2026-09-23T00:00:00Z', end: '2026-09-23T03:00:00Z' }]);
assert.deepEqual(JSON.parse(JSON.stringify(nonBlocking.freeGaps)), [
  { start: '2026-09-23T00:00:00.000Z', end: '2026-09-23T03:00:00.000Z' }
]);

function deriveGaps(businessWindows, events = []) {
  return JSON.parse(JSON.stringify(core.derive(events, '2026-09-23T00:00:00Z', '2026-09-23',
    { start: '2026-09-23T00:00:00Z', end: '2026-09-24T00:00:00Z' }, businessWindows).freeGaps));
}

const fullBusinessDay = [
  { start: '2026-09-23T09:00:00.000Z', end: '2026-09-23T18:00:00.000Z' }
];
assert.deepEqual(deriveGaps([
  { start: '2026-09-23T09:00:00Z', end: '2026-09-23T12:00:00Z' },
  { start: '2026-09-23T11:00:00Z', end: '2026-09-23T18:00:00Z' }
]), fullBusinessDay, 'overlapping business windows merge without duplicate gaps');
assert.deepEqual(deriveGaps([
  { start: '2026-09-23T09:00:00Z', end: '2026-09-23T12:00:00Z' },
  { start: '2026-09-23T12:00:00Z', end: '2026-09-23T18:00:00Z' }
]), fullBusinessDay, 'adjacent business windows merge');
assert.deepEqual(deriveGaps([
  { start: '2026-09-23T09:00:00Z', end: '2026-09-23T12:00:00Z' },
  { start: '2026-09-23T13:00:00Z', end: '2026-09-23T18:00:00Z' }
]), [
  { start: '2026-09-23T09:00:00.000Z', end: '2026-09-23T12:00:00.000Z' },
  { start: '2026-09-23T13:00:00.000Z', end: '2026-09-23T18:00:00.000Z' }
], 'separated business windows remain separate');
assert.deepEqual(deriveGaps([
  { start: '2026-09-23T09:00:00Z', end: '2026-09-23T12:00:00Z' },
  { start: '2026-09-23T11:00:00Z', end: '2026-09-23T18:00:00Z' }
], [timed({ start: { dateTime: '2026-09-23T12:00:00Z' }, end: { dateTime: '2026-09-23T13:00:00Z' } })]), [
  { start: '2026-09-23T09:00:00.000Z', end: '2026-09-23T12:00:00.000Z' },
  { start: '2026-09-23T13:00:00.000Z', end: '2026-09-23T18:00:00.000Z' }
], 'busy events subtract from a merged business window');

const derived = core.derive([timed(), timed({ id: 'later', start: { dateTime: '2026-09-23T04:00:00Z' }, end: { dateTime: '2026-09-23T05:00:00Z' } })],
  '2026-09-23T01:30:00Z', '2026-09-23',
  { start: '2026-09-23T00:00:00Z', end: '2026-09-24T00:00:00Z' },
  [{ start: '2026-09-23T00:00:00Z', end: '2026-09-23T06:00:00Z' }]);
assert.equal(derived.currentOrNextEvent.id, 'event-1');
assert.equal(core.derive([], '2026-09-23T00:00:00Z', '2026-09-23',
  { start: '2026-09-23T00:00:00Z', end: '2026-09-24T00:00:00Z' }, []).timedEvents.length, 0);
assert.equal(core.derive([multiDay], '2026-09-23T00:00:00Z', '2026-09-23',
  { start: '2026-09-23T00:00:00Z', end: '2026-09-24T00:00:00Z' },
  [{ start: '2026-09-23T00:00:00Z', end: '2026-09-23T06:00:00Z' }]).freeGaps.length, 0);

// UTC instants are unaffected by a test runner's/device's timezone.
assert.equal(timed({ start: { dateTime: '2026-09-23T10:00:00+09:00' } }).start, '2026-09-23T01:00:00.000Z');
console.log('schedule core tests passed');
