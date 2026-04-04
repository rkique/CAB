require('../distribution.js')();
require('./helpers/sync-guard');
const distribution = globalThis.distribution;

test('(1 pts) local.mem.get(no key)', (done) => {
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

  distribution.local.mem.put(users[0], keys[0], (e, v) => {
    distribution.local.mem.put(users[1], keys[1], (e, v) => {
      distribution.local.mem.put(users[2], keys[2], (e, v) => {
        distribution.local.mem.get(null, (e, v) => {
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

test('(1 pts) local.mem.get(no key)', (done) => {
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

  distribution.local.mem.put(users[0], keys[0], (e, v) => {
    distribution.local.mem.put(users[1], keys[1], (e, v) => {
      distribution.local.mem.put(users[2], keys[2], (e, v) => {
        distribution.local.mem.get(null, (e, v) => {
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


test('(0 pts) local.mem.get(null) returns keys', (done) => {
  const key = 'memkeys1';
  const value = {hello: 'world'};

  distribution.local.mem.put(value, key, (e, v) => {
    distribution.local.mem.get(null, (e, v) => {
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

