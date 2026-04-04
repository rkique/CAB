/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')({ip: '127.0.0.1', port: 7070});
const id = distribution.util.id;
const log = require('../../distribution/util/log.js');
require('../helpers/sync-guard');

//test groups.get("calanthea")/put/get/add,
test('(1 pts) student test', (done) => {
  //First get should not return any group.
  distribution.local.groups.get('calanthea', (e, v) => {
    try {
      expect(e).toBeDefined();
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();

      const g = {
        '507aa': { ip: '127.0.0.1', port: 1818 },
        '12ab0': { ip: '127.0.0.1', port: 1819 },
      };
      //After put, second get should return calanthea.
      distribution.local.groups.put('calanthea', g, (e, v) => {
        distribution.local.groups.get('calanthea', (e, v) => {
          try {
            expect(e).toBeFalsy();
            expect(v).toEqual(g);
          } catch (error) {
            done(error);
          }
        });
      });
      //We should be able to add to calanthea.
      const n2 = { ip: '127.0.0.1', port: 1820 };
      distribution.local.groups.add('calanthea', n2, (e, v) => {
        try {
          console.log('error:', e);
          expect(e).toBeFalsy();
          const expectedGroup = {"12ab0": {"ip": "127.0.0.1", "port": 1819},
                                 "507aa": {"ip": "127.0.0.1", "port": 1818}, 
                                 "eb844": {"ip": "127.0.0.1", "port": 1820}};
          expect(v).toEqual(expectedGroup);
          distribution.local.groups.get('calanthea', (e, v) => {
            try {
              expect(e).toBeFalsy();
              expect(v[id.getSID(n2)]).toEqual(n2);
              done();
            } catch (error) {
              done(error);
            }
          });
        } catch (error) {
          done(error);
        }
      });
    } catch (error) {
      done(error);
    }
  });
});

//test local.comm.send, local.routes.get(), and local/node.js support of distributed services
const mygroupConfig = { gid: 'mygroup' };
const mygroupGroup = {};
const n1 = { ip: '127.0.0.1', port: 7001 };
const n2 = { ip: '127.0.0.1', port: 7002 };
const n3 = { ip: '127.0.0.1', port: 7003 };
const n4 = { ip: '127.0.0.1', port: 7004 };
const n5 = { ip: '127.0.0.1', port: 7005 };
const n6 = { ip: '127.0.0.1', port: 7006 };
const group4Group = {};
group4Group[id.getSID(n1)] = n1;
group4Group[id.getSID(n3)] = n3;

beforeAll((done) => {
  // First, stop the nodes if they are running
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
              startNodes();
            });
          });
        });
      });
    });
  });

  const startNodes = () => {
    mygroupGroup[id.getSID(n1)] = n1;
    mygroupGroup[id.getSID(n2)] = n2;
    mygroupGroup[id.getSID(n3)] = n3;
    mygroupGroup[id.getSID(n4)] = n4;
    mygroupGroup[id.getSID(n5)] = n5;

    const group4Config = {gid: 'group4'};

    const groupInstantiation = () => {
      // Create the groups
      distribution.local.groups
          .put(mygroupConfig, mygroupGroup, (e, v) => {
            distribution.local.groups.put(
          group4Config, group4Group, (e,v) => done())
          });
    };


    // Now, start the nodes listening node
    distribution.node.start((e) => {
      if (e) {
        done(e);
        return;
      }
      const nowMs = () => Number(process.hrtime.bigint()) / 1e6;
      const spawnLatency = {};
      const totalSpawnStartMs = nowMs();

      const markSpawnStart = (node) => {
        spawnLatency[id.getSID(node)] = {port: node.port, startMs: nowMs()};
      };

      const markSpawnEnd = (node) => {
        const sid = id.getSID(node);
        spawnLatency[sid].latencyMs = nowMs() - spawnLatency[sid].startMs;
      };

      const printSpawnLatencySummary = () => {
        const perNode = Object.values(spawnLatency)
            .map((entry) => `:${entry.port}=${entry.latencyMs.toFixed(2)}ms`)
            .join(', ');
        const totalMs = nowMs() - totalSpawnStartMs;
        console.log(`[m3.student] spawn latency (${Object.keys(spawnLatency).length} nodes) total=${totalMs.toFixed(2)}ms | ${perNode}`);
      };

      // Start the nodes
      markSpawnStart(n1);
      distribution.local.status.spawn(n1, (e, v) => {
        if (e) {
          done(e);
          return;
        }
        markSpawnEnd(n1);
        markSpawnStart(n2);
        distribution.local.status.spawn(n2, (e, v) => {
          if (e) {
            done(e);
            return;
          }
          markSpawnEnd(n2);
          markSpawnStart(n3);
          distribution.local.status.spawn(n3, (e, v) => {
            if (e) {
              done(e);
              return;
            }
            markSpawnEnd(n3);
            markSpawnStart(n4);
            distribution.local.status.spawn(n4, (e, v) => {
              if (e) {
                done(e);
                return;
              }
              markSpawnEnd(n4);
              markSpawnStart(n5);
              distribution.local.status.spawn(n5, (e, v) => {
                if (e) {
                  done(e);
                  return;
                }
                markSpawnEnd(n5);
                markSpawnStart(n6);
                distribution.local.status.spawn(n6, (e, v) => {
                  if (e) {
                    done(e);
                    return;
                  }
                  markSpawnEnd(n6);
                  printSpawnLatencySummary();
                  groupInstantiation();
                });
              });
            });
          });
        });
      });
    }); ;
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


//check all SID values for mygroup via comm.send
test('(1 pts) student test', (done) => {
  const sids = Object.values(mygroupGroup).map((node) => id.getSID(node));
  const remote = {service: 'status', method: 'get'};
  distribution.mygroup.comm.send(['sid'], remote, (e, v) => {
    try {
      expect(e).toEqual({});
      expect(Object.values(v).length).toEqual(sids.length);
      console.log('values of v:', Object.values(v));
      expect(Object.values(v)).toEqual(expect.arrayContaining(sids));
      done();
    } catch (error) {
      done(error);
    }
  });
});

//no godot status returned from any node
test('(1 pts) student test', (done) => {
  distribution.mygroup.status.get('godot', (e, v) => {
      try {
        Object.keys(mygroupGroup).forEach((sid) => {
          expect(e[sid]).toBeDefined();
          expect(e[sid]).toBeInstanceOf(Error);
        });
        expect(v).toEqual({});
        done();
      } catch (error) {
        done(error);
      }
    });
});

const group4Group = {};
group4Group[id.getSID(n1)] = n1;
group4Group[id.getSID(n3)] = n3;

//Put g into browncs for all members of group4
test('(1 pts) student test', (done) => {
  const g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '14ab0': {ip: '127.0.0.1', port: 8081},
  };
  distribution.group4.groups.put('browncs', g, (e,v) => {
    try {
      expect(e).toEqual({});
      Object.keys(group4Group).forEach((sid) => {
        expect(v[sid]).toEqual(g);
      });
      done();
    } catch (error) {
      done(error);
    }
  });
});

//check that all.routes.put sends appropriate f to each node
test('(1 pts) student test', (done) => {
  const pingService = {};

  pingService.ping = () => {
    return 'ping!'
  };

  distribution.mygroup.routes.put(pingService, 'ping', () => {
      const req = {node: n3, service: 'routes', method: 'get'}
      distribution.local.comm.send(['ping'], req, (e,v) => {
        try {
          expect(e).toBeFalsy();
          expect(v.ping()).toEqual('ping!')
          done()
        } catch(error){
          done(error);
        }
      })
  })
});
