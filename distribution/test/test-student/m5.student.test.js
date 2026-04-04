/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');

// all.mr:exec-min
test('(1 pts) student test', (done) => {
  const dataset = [
    {'orchestrator-key': 'value'},
  ];
  const keys = getDatasetKeys(dataset);
  //mapper emits a count of 1 for each key
  const mapper = (key, value) => {
    const out = {};
    out[key] = 1;
    return [out];
  };

  // reducer sums counts for each key.
  const reducer = (key, values) => {
    const out = {};
    out[key] = values.reduce((sum, v) => sum + v, 0);
    return out;
  };

  distribution.ncdc.store.put(dataset[0][keys[0]], keys[0], (putErr) => {
    if (putErr) {
      done(putErr);
      return;
    }

    distribution.ncdc.mr.exec({keys, map: mapper, reduce: reducer}, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toEqual(expect.arrayContaining([{'orchestrator-key': 1}]));
        done();
      } catch (assertErr) {
        done(assertErr);
      }
    });
  });
});

//all.mr:exec-noops-min
// test('(1 pts) student test', (done) => {
//   const noopMap = () => [];
//   const noopReduce = () => ({});

//   //implements no-op map and reduce functions, just to test the full execution flow of mr.exec.
//   distribution.ncdc.mr.exec({keys: [], map: noopMap, reduce: noopReduce},
//      (e, v) => {
//     try {
//       expect(e).toBeFalsy();
//       expect(Array.isArray(v)).toBe(true);
//       done();
//     } catch (assertErr) {
//       done(assertErr);
//     }
//   });
// });

// test('(1 pts) student test', (done) => {
//   // Fill out this test case...
//     done(new Error('Not implemented'));
// });

// test('(1 pts) student test', (done) => {
//   // Fill out this test case...
//     done(new Error('Not implemented'));
// });

// test('(1 pts) student test', (done) => {
//   // Fill out this test case...
//     done(new Error('Not implemented'));
// });

//** TEST SETUP */
const id = distribution.util.id;

const ncdcGroup = {};
const avgwrdlGroup = {};
const cfreqGroup = {};

/*
  The local node will be the orchestrator.
*/

const n1 = {ip: '127.0.0.1', port: 7110};
const n2 = {ip: '127.0.0.1', port: 7111};
const n3 = {ip: '127.0.0.1', port: 7112};

function getDatasetKeys(dataset) {
  return dataset.map((o) => Object.keys(o)[0]);
}

beforeAll((done) => {
  try {
    ncdcGroup[id.getSID(n1)] = n1;
    ncdcGroup[id.getSID(n2)] = n2;
    ncdcGroup[id.getSID(n3)] = n3;

    avgwrdlGroup[id.getSID(n1)] = n1;
    avgwrdlGroup[id.getSID(n2)] = n2;
    avgwrdlGroup[id.getSID(n3)] = n3;

    cfreqGroup[id.getSID(n1)] = n1;
    cfreqGroup[id.getSID(n2)] = n2;
    cfreqGroup[id.getSID(n3)] = n3;


    const startNodes = (cb) => {
      distribution.local.status.spawn(n1, (e, v) => {
        if (e) {
          done(e);
          return;
        }
        distribution.local.status.spawn(n2, (e, v) => {
          if (e) {
            done(e);
            return;
          }
          distribution.local.status.spawn(n3, (e, v) => {
            if (e) {
              done(e);
              return;
            }
            cb();
          });
        });
      });
    };

    distribution.node.start((e) => {
      if (e) {
        done(e);
        return;
      }
      const ncdcConfig = {gid: 'ncdc'};
      startNodes(() => {
        distribution.local.groups.put(ncdcConfig, ncdcGroup, (e, v) => {
          distribution.ncdc.groups.put(ncdcConfig, ncdcGroup, (e, v) => {
            const avgwrdlConfig = {gid: 'avgwrdl'};
            distribution.local.groups.put(avgwrdlConfig, avgwrdlGroup, (e, v) => {
              distribution.avgwrdl.groups.put(avgwrdlConfig, avgwrdlGroup, (e, v) => {
                const cfreqConfig = {gid: 'cfreq'};
                distribution.local.groups.put(cfreqConfig, cfreqGroup, (e, v) => {
                  distribution.cfreq.groups.put(cfreqConfig, cfreqGroup, (e, v) => {
                    done();
                  });
                });
              });
            });
          });
        });
      });
    });
  } catch (e) {
    done(e);
  }
});

afterAll((done) => {
  const remote = {service: 'status', method: 'stop'};
  remote.node = n1;
  distribution.local.comm.send([], remote, (e, v) => {
    remote.node = n2;
    distribution.local.comm.send([], remote, (e, v) => {
      remote.node = n3;
      distribution.local.comm.send([], remote, (e, v) => {
        if (globalThis.distribution.node.server) {
          globalThis.distribution.node.server.close();
        }
        done();
      });
    });
  });
});
