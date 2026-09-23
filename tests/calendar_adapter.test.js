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
assert.deepEqual(JSON.parse(JSON.stringify(load({ Events: { list() { return { items: [] }; } } }).list('id', 'a', 'b'))), []);
console.log('calendar adapter tests passed');
