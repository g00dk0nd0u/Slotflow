const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const context = {
  Date,
  SlotflowConfig: { load() { return { calendarId: 'private', timezone: 'Asia/Tokyo', businessHours: {} }; } },
  CalendarReadAdapter: { list() { throw new Error('authorization denied'); } },
  ScheduleCore: {}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('apps-script/ScheduleService.gs', 'utf8'), context);
const result = context.getDashboardSchedule();
assert.equal(result.ok, false);
assert.equal(result.error.code, 'SCHEDULE_UNAVAILABLE');
assert.equal(Object.hasOwn(result, 'today'), false, 'provider failure must not resemble an empty day');
assert.equal(JSON.stringify(result).includes('authorization denied'), false, 'provider details are not exposed');
console.log('schedule service failure test passed');
