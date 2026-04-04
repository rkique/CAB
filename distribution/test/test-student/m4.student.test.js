/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
const id = distribution.util.id;
require('../helpers/sync-guard');

// test local mem and local store
test('(1 pts) student test', (done) => {
  const fish = {fins: 2, name: 'Fliggins'};
  const key = 'fl1g';

  distribution.local.mem.put(fish, key, (e) => {
    if (e) return done(e);

    distribution.local.mem.del(key, (e) => {
      if (e) return done(e);

      distribution.local.mem.get(key, (e, v) => {
        try {
          expect(e).toBeInstanceOf(Error);
          expect(v).toBeFalsy();
        } catch (error) {
          return done(error);
        }

        distribution.local.store.put(fish, key, (e) => {
          if (e) return done(e);

          distribution.local.store.get(key, (e, v) => {
            try {
              expect(e).toBeFalsy();
              expect(v).toEqual(fish);
              done();
            } catch (error) {
              done(error);
            }
          });
        });
      });
    });
  });
});

//test distributed store
test('(1 pts) student test', (done) => {
  const fish = {name: 'Fliggss9F((C', fins: 5}
  distribution.g2.store.put(fish, null, (e, v) => {
    distribution.g2.store.get(id.getID(fish), (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toEqual(fish);
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

//test distributed mem
test('(1 pts) student test', (done) => {
  const fish = {fins: 2, name: 'Fliggins'}
  const key = 'fl1g'
  distribution.all.mem.put(fish, key, (e, v) => {
    distribution.all.mem.get(key, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toEqual(fish);
        distribution.all.mem.del(key, (e, v) => {
          distribution.g2.mem.get(key, (e, v) => {
            try {
              expect(e).toBeInstanceOf(Error);
              expect(v).toBeFalsy();
              done();
            } catch (error) {
              done(error);
            }
          });
        });
      } catch (error) {
        done(error);
      }
    });
  });
});


test('(1 pts) student test', (done) => {
  const user = {name: 'fFIx', age: 128};
  const key = '9999';
  const kid = id.getID(key);
  distribution.g3.store.put(user, {key: key, gid: 'g3'}, (e, v) => {
    if (e) return done(e);
    distribution.g3.store.get(kid, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toEqual(user);
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

//test consistent hash 
test('(1 pts) student test', (done) => {
  const key = 'jcarb';
  const nodes = [
    {ip: '127.0.0.1', port: 10000},
    {ip: '127.0.0.1', port: 10001},
    {ip: '127.0.0.1', port: 10002},
  ];
  //get the kid for the key.
  const kid = id.getID(key);
  const nids = nodes.map((node) => id.getNID(node));
  //get consistent hash for kid + nids.
  const hash = id.consistentHash(kid, nids);
  const expectedHash = '8970c41015d3ccbf1f46691ae77ab225aa6c3d401f6c1c5297f4df7ec35c72b0';
  try {
    expect(expectedHash).toBeTruthy();
    expect(hash).toEqual(expectedHash);
    done();
  } catch (error) {
    done(error);
  }
});

test('local.mem.get(no key)', (done) => {
  const user = {first: 'Josiah', last: 'Carberry'};
  distribution.local.mem.get(null, (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('local.store.get(no key)', (done) => {
  const user = {first: 'Josiah', last: 'Carberry'};
  distribution.local.store.get(null, (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});


const g1 = {};
const g2 = {};
const g3 = {};
const n1 = {ip: '127.0.0.1', port: 9001};
const n2 = {ip: '127.0.0.1', port: 9002};
const n3 = {ip: '127.0.0.1', port: 9003};
const n4 = {ip: '127.0.0.1', port: 9004};
const n5 = {ip: '127.0.0.1', port: 9005};
const n6 = {ip: '127.0.0.1', port: 9006};

beforeAll((done) => {
  // First, stop the nodes if they are running
  const remote = {service: 'status', method: 'stop'};

  const fs = require('fs');
  const path = require('path');

  fs.rmSync(path.join(__dirname, '../store'), {recursive: true, force: true});
  fs.mkdirSync(path.join(__dirname, '../store'));

  remote.node = n1;
  distribution.local.comm.send([], remote, (e, v) => {
    remote.node = n2;
    distribution.local.comm.send([], remote, (e, v) => {
      remote.node = n3;
      distribution.local.comm.send([], remote, (e, v) => {
        remote.node = n4;
        distribution.local.comm.send([], remote, (e, v) => {
          remote.node = n5;
          distribution.local.comm.send([], remote, (e, v) => {
            remote.node = n6;
            distribution.local.comm.send([], remote, (e, v) => {
              startNodes();
            });
          });
        });
      });
    });
  });

  const startNodes = () => {
    g1[id.getSID(n1)] = n1;
    g1[id.getSID(n2)] = n2;
    g1[id.getSID(n3)] = n3;
    g1[id.getSID(n4)] = n4;
    g1[id.getSID(n5)] = n5;

    g2[id.getSID(n1)] = n1;
    g2[id.getSID(n2)] = n2;
    g2[id.getSID(n3)] = n3;
    g2[id.getSID(n4)] = n4;
    g2[id.getSID(n5)] = n5;

    g3[id.getSID(n2)] = n2;
    g3[id.getSID(n3)] = n3;
    g3[id.getSID(n4)] = n4;

    // Now, start the nodes listening node
    distribution.node.start((e) => {
      if (e) {
        done(e);
        return;
      }
      const groupInstantiation = () => {
        const g1Config = {gid: 'g1'};
        const g2Config = {gid: 'g2', hash: id.rendezvousHash};
        const g3config = {gid: 'g3'};

        // put g2 under g2config, g1 under g1config for local+mygroup
        distribution.local.groups.put(g3config, g3, (e, v) => {
        distribution.local.groups.put(g2Config, g2, (e, v) => {
          distribution.local.groups.put(g1Config, g1, (e, v) => {
            distribution.g1.groups.put(g1Config, g1, (e, v) => {
              done();
            });
          });
        });
      });
      };

      // Start the nodes
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
            distribution.local.status.spawn(n4, (e, v) => {
              if (e) {
                done(e);
                return;
              }
              distribution.local.status.spawn(n5, (e, v) => {
                if (e) {
                  done(e);
                  return;
                }
                distribution.local.status.spawn(n6, (e, v) => {
                  if (e) {
                    done(e);
                    return;
                  }
                  groupInstantiation();
                });
              });
            });
          });
        });
      });
    });
  };
});

afterAll((done) => {
  const remote = {service: 'status', method: 'stop'};
  remote.node = n1;
  distribution.local.comm.send([], remote, (e, v) => {
    remote.node = n2;
    distribution.local.comm.send([], remote, (e, v) => {
      remote.node = n3;
      distribution.local.comm.send([], remote, (e, v) => {
        remote.node = n4;
        distribution.local.comm.send([], remote, (e, v) => {
          remote.node = n5;
          distribution.local.comm.send([], remote, (e, v) => {
            remote.node = n6;
            distribution.local.comm.send([], remote, (e, v) => {
              if (globalThis.distribution.node.server) {
                globalThis.distribution.node.server.close();
              }
              done();
            });
          });
        });
      });
    });
  });
});
