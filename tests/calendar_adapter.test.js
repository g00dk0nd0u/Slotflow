const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load(calendar) {
  const context = calendar === undefined ? {} : { Calendar: calendar };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('apps-script/CalendarReadAdapter.gs', 'utf8'), context);
  return context.CalendarReadAdapter;
}

assert.throws(() => load().list('id', 'a', 'b'), /unavailable/);
assert.throws(() => load({ Events: { list() { throw new Error('quota exceeded'); } } }).list('id', 'a', 'b'), /quota exceeded/);
assert.throws(() => load({ Events: { list() { return null; } } }).list('id', 'a', 'b'), /invalid event list/);
assert.deepEqual(JSON.parse(JSON.stringify(load({ Events: { list() { return {}; } } }).list('id', 'a', 'b'))), []);
assert.deepEqual(JSON.parse(JSON.stringify(load({ Events: { list() { return { items: null }; } } }).list('id', 'a', 'b'))), []);
assert.deepEqual(JSON.parse(JSON.stringify(load({ Events: { list() { return { items: [] }; } } }).list('id', 'a', 'b'))), []);
assert.throws(() => load({ Events: { list() { return { items: 'bad' }; } } }).list('id', 'a', 'b'), /invalid event list/);

let page = 0;
const paginated = load({ Events: { list() {
  page += 1;
  return page === 1
    ? { items: [{ id: 'first' }], nextPageToken: 'next' }
    : { items: [{ id: 'second' }] };
} } }).list('id', 'a', 'b');
assert.deepEqual(JSON.parse(JSON.stringify(paginated)), [{ id: 'first' }, { id: 'second' }]);
assert.equal(page, 2);
console.log('calendar adapter tests passed');
