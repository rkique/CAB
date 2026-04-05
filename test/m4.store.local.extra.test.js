require('../distribution.js')();
require('./helpers/sync-guard');
const distribution = globalThis.distribution;
const local = distribution.local;

test('(2 pts) local.store.get(no key)', (done) => {
  const users = [
    {first: 'Emma', last: 'Watson'},
    {first: 'John', last: 'Krasinski'},
    {first: 'Julie', last: 'Bowen'},
  ];
  const keys = [
    'ewatson',
    'jkrasinski',
    'jbowen',
  ];

  distribution.local.store.put(users[0], keys[0], (e, v) => {
    distribution.local.store.put(users[1], keys[1], (e, v) => {
      distribution.local.store.put(users[2], keys[2], (e, v) => {
        distribution.local.store.get(null, (e, v) => {
          try {
            expect(e).toBeFalsy();
            expect(Object.values(v)).toEqual(expect.arrayContaining(keys));
            done();
          } catch (error) {
            done(error);
          }
        });
      });
    });
  });
});

test('(2 pts) local.store.get(no key)', (done) => {
  const users = [
    {first: 'Saul', last: 'Goodman'},
    {first: 'Walter', last: 'White'},
    {first: 'Jesse', last: 'Pinkman'},
  ];
  const keys = [
    'sgoodman',
    'wwhite',
    'jpinkman',
  ];

  local.store.put(users[0], keys[0], (e, v) => {
    local.store.put(users[1], keys[1], (e, v) => {
      local.store.put(users[2], keys[2], (e, v) => {
        local.store.get(null, (e, v) => {
          try {
            expect(e).toBeFalsy();
            expect(Object.values(v)).toEqual(expect.arrayContaining(keys));
            done();
          } catch (error) {
            done(error);
          }
        });
      });
    });
  });
});

test('(0 pts) local.store.get(null) returns keys', (done) => {
  const user = {first: 'Key', last: 'Collector'};
  const key = 'storekeys1';

  local.store.put(user, key, (e, v) => {
    local.store.get(null, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(Array.isArray(v)).toBe(true);
        expect(v).toContain(key);
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});


