const assert = require('node:assert/strict');
const fs = require('node:fs');

const manifest = JSON.parse(fs.readFileSync('apps-script/appsscript.json', 'utf8'));
const calendarEventsReadonlyScope =
  'https://www.googleapis.com/auth/calendar.events.readonly';

assert.deepEqual(
  manifest.oauthScopes,
  [calendarEventsReadonlyScope],
  'owner manifest must request only read access to Calendar events'
);
assert.ok(
  !manifest.oauthScopes.includes('https://www.googleapis.com/auth/calendar.readonly'),
  'owner manifest must not regress to the broader Calendar read-only scope'
);

console.log('owner manifest tests passed');
