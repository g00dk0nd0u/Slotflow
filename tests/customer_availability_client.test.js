const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync('apps-script-customer/Availability.html', 'utf8');
assert.match(source, /getAvailabilityOptions/);
assert.match(source, /getAvailability/);
assert.match(source, /response\.phoneHref/);
assert.match(source, /電話で確認する/);
assert.match(source, /current!==sequence/, 'stale availability responses are ignored');
['create' + 'Booking', 'request' + 'Id', 'finger' + 'print', 'お名' + '前', '連絡' + '先', '予約を' + '確定',
  'Calendar.Events.' + 'insert', 'Lock' + 'Service'].forEach((term) => {
  assert.equal(source.includes(term), false, `write-only term remains: ${term}`);
});
console.log('customer availability client tests passed');
