/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');

const id = distribution.util.id;

const studentGroup = {};
const n1 = {ip: '127.0.0.1', port: 7120};
const n2 = {ip: '127.0.0.1', port: 7121};
const n3 = {ip: '127.0.0.1', port: 7122};

function hasRealError(e) {
  if (!e) return false;
  if (e instanceof Error) return true;
  if (typeof e !== 'object') return true;
  return Object.keys(e).length > 0;
}

function sortObjectsByKey(arr) {
  return [...arr].sort((a, b) => {
    const ka = Object.keys(a)[0];
    const kb = Object.keys(b)[0];
    return ka.localeCompare(kb);
  });
}

test('(1 pts) student test', (done) => {
  const gid = 'student';

  const mapper = (key, value) => {
    const out = {};
    out[key] = value.length;
    return [out];
  };

  const reducer = (key, values) => {
    const out = {};
    out[key] = values.reduce((sum, v) => sum + v, 0);
    return out;
  };

  distribution[gid].store.put('apple', 'fruit', (e) => {
    if (hasRealError(e)) {
      done(e);
      return;
    }

    distribution[gid].mr.exec({keys: ['fruit'], map: mapper, reduce: reducer}, (err, value) => {
      try {
        expect(hasRealError(err)).toBe(false);
        expect(value).toEqual([{fruit: 5}]);
        done();
      } catch (ex) {
        done(ex);
      }
    });
  });
});

test('(1 pts) student test', (done) => {
  const gid = 'student';

  const mapper = (key, value) => {
    const out = {};
    out[key] = value.toUpperCase();
    return [out];
  };

  const reducer = (key, values) => {
    const out = {};
    out[key] = values[0];
    return out;
  };

  distribution[gid].store.put('hello', 'present', (e) => {
    if (hasRealError(e)) {
      done(e);
      return;
    }

    distribution[gid].mr.exec({keys: ['present', 'missing'], map: mapper, reduce: reducer}, (err, value) => {
      try {
        expect(hasRealError(err)).toBe(false);
        expect(value).toEqual([{present: 'HELLO'}]);
        done();
      } catch (ex) {
        done(ex);
      }
    });
  });
});

test('(1 pts) student test', (done) => {
  const gid = 'student';

  const mapper = (key, value) => {
    const out = {};
    out[value] = 1;
    return [out];
  };

  const reducer = (key, values) => {
    const out = {};
    out[key] = values.reduce((sum, v) => sum + v, 0);
    return out;
  };

  distribution[gid].store.put('red', 'c1', (e1) => {
    if (hasRealError(e1)) {
      done(e1);
      return;
    }
    distribution[gid].store.put('red', 'c2', (e2) => {
      if (hasRealError(e2)) {
        done(e2);
        return;
      }
      distribution[gid].store.put('blue', 'c3', (e3) => {
        if (hasRealError(e3)) {
          done(e3);
          return;
        }

        distribution[gid].mr.exec({keys: ['c1', 'c2', 'c3'], map: mapper, reduce: reducer}, (err, value) => {
          try {
            expect(hasRealError(err)).toBe(false);
            expect(sortObjectsByKey(value)).toEqual(sortObjectsByKey([{red: 2}, {blue: 1}]));
            done();
          } catch (ex) {
            done(ex);
          }
        });
      });
    });
  });
});

test('(1 pts) student test', (done) => {
  const gid = 'student';

  const mapper = (key, value) => {
    return value.split(/\s+/).filter((w) => w !== '').map((word) => {
      const out = {};
      out[word] = 1;
      return out;
    });
  };

  const reducer = (key, values) => {
    const out = {};
    out[key] = values.reduce((sum, v) => sum + v, 0);
    return out;
  };

  distribution[gid].store.put('go go stop', 'line1', (e) => {
    if (hasRealError(e)) {
      done(e);
      return;
    }

    distribution[gid].mr.exec({keys: ['line1'], map: mapper, reduce: reducer}, (err, value) => {
      try {
        expect(hasRealError(err)).toBe(false);
        expect(sortObjectsByKey(value)).toEqual(sortObjectsByKey([{go: 2}, {stop: 1}]));
        done();
      } catch (ex) {
        done(ex);
      }
    });
  });
});

test('(1 pts) student test', (done) => {
  const gid = 'student';

  const mapper = (key, value) => {
    const out = {};
    out[key] = value.length % 2 === 0 ? 'even' : 'odd';
    return [out];
  };

  const reducer = (key, values) => {
    const out = {};
    out[key] = values[0];
    return out;
  };

  distribution[gid].store.put('four', 'kEven', (e1) => {
    if (hasRealError(e1)) {
      done(e1);
      return;
    }
    distribution[gid].store.put('cat', 'kOdd', (e2) => {
      if (hasRealError(e2)) {
        done(e2);
        return;
      }

      distribution[gid].mr.exec({keys: ['kEven', 'kOdd'], map: mapper, reduce: reducer}, (err, value) => {
        try {
          expect(hasRealError(err)).toBe(false);
          expect(sortObjectsByKey(value)).toEqual(sortObjectsByKey([{kEven: 'even'}, {kOdd: 'odd'}]));
          done();
        } catch (ex) {
          done(ex);
        }
      });
    });
  });
});

beforeAll((done) => {
  studentGroup[id.getSID(n1)] = n1;
  studentGroup[id.getSID(n2)] = n2;
  studentGroup[id.getSID(n3)] = n3;

  const startNodes = (cb) => {
    distribution.local.status.spawn(n1, (e) => {
      if (hasRealError(e)) {
        done(e);
        return;
      }
      distribution.local.status.spawn(n2, (e2) => {
        if (hasRealError(e2)) {
          done(e2);
          return;
        }
        distribution.local.status.spawn(n3, (e3) => {
          if (hasRealError(e3)) {
            done(e3);
            return;
          }
          cb();
        });
      });
    });
  };

  distribution.node.start((e) => {
    if (hasRealError(e)) {
      done(e);
      return;
    }

    const config = {gid: 'student'};
    startNodes(() => {
      distribution.local.groups.put(config, studentGroup, (e1) => {
        if (hasRealError(e1)) {
          done(e1);
          return;
        }
        distribution.student.groups.put(config, studentGroup, (e2) => {
          if (hasRealError(e2)) {
            done(e2);
            return;
          }
          done();
        });
      });
    });
  });
});

afterAll((done) => {
  const remote = {service: 'status', method: 'stop'};
  remote.node = n1;
  distribution.local.comm.send([], remote, () => {
    remote.node = n2;
    distribution.local.comm.send([], remote, () => {
      remote.node = n3;
      distribution.local.comm.send([], remote, () => {
        if (globalThis.distribution.node.server) {
          globalThis.distribution.node.server.close();
        }
        done();
      });
    });
  });
});