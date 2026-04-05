require('../distribution.js')();
require('./helpers/sync-guard');
const distribution = globalThis.distribution;
const id = distribution.util.id;

jest.spyOn(process, 'exit').mockImplementation((n) => { });

test('(2 pts) local.comm.send(all.status.get(nid))', (done) => {
  const mygroupConfig = {gid: 'mygroup'};
  const nids = Object.values(mygroupGroup).map((node) => id.getNID(node));
  const remote = {node: n5, service: 'groups', method: 'put'};

  // first register mygroup on n5
  distribution.local.comm.send([mygroupConfig, mygroupGroup], remote, (e, v) => {
    try {
      expect(e).toBeFalsy();
    } catch (error) {
      done(error);
      return;
    }
    const remote = {node: n5, gid: 'mygroup', service: 'status', method: 'get'};

    // from local node, run mygroup.status.get() on n5 via send()
    distribution.local.comm.send(['nid'], remote, (e, v) => {
      try {
        expect(e).toEqual({});
        expect(Object.values(v).length).toEqual(nids.length);
        expect(Object.values(v)).toEqual(expect.arrayContaining(nids));
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

test('(2 pts) all.status.get(nid)', (done) => {
  const nids = Object.values(mygroupGroup).map((node) => id.getNID(node));

  distribution.mygroup.status.get('nid', (e, v) => {
    try {
      expect(e).toEqual({});
      expect(Object.values(v).length).toEqual(nids.length);
      expect(Object.values(v)).toEqual(expect.arrayContaining(nids));
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) all.status.get(nid) matches distributed status', (done) => {
  const remote = {service: 'status', method: 'get'};
  distribution.mygroup.comm.send(['nid'], remote, (e, v) => {
    if (Object.keys(e).length !== 0) {
      done(e);
      return;
    }
    const expected = Object.values(v);
    distribution.mygroup.status.get('nid', (e, v) => {
      try {
        expect(e).toEqual({});
        expect(v).toEqual(expect.arrayContaining(expected));
        expect(v).toHaveLength(expected.length);
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

test('(0 pts) all.status.get(sid)', (done) => {
  const remote = {service: 'status', method: 'get'};
  distribution.mygroup.comm.send(['sid'], remote, (e, v) => {
    if (Object.keys(e).length !== 0) {
      done(e);
      return;
    }
    const expected = Object.values(v);
    distribution.mygroup.status.get('sid', (e, v) => {
      try {
        expect(e).toEqual({});
        expect(v).toEqual(expect.arrayContaining(expected));
        expect(v).toHaveLength(expected.length);
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

test('(0 pts) all.status.get(heapTotal)', (done) => {
  const remote = {service: 'status', method: 'get'};
  distribution.mygroup.comm.send(['heapTotal'], remote, (e, v) => {
    if (Object.keys(e).length !== 0) {
      done(e);
      return;
    }
    const expected = Object.values(v).reduce((acc, val) => acc + val, 0);
    distribution.mygroup.status.get('heapTotal', (e, v) => {
      try {
        expect(e).toEqual({});
        expect(v).toEqual(expected);
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

test('(0 pts) all.status.get(heapUsed)', (done) => {
  const remote = {service: 'status', method: 'get'};
  distribution.mygroup.comm.send(['heapUsed'], remote, (e, v) => {
    if (Object.keys(e).length !== 0) {
      done(e);
      return;
    }
    const expectedSids = Object.keys(v);
    distribution.mygroup.status.get('heapUsed', (e, v) => {
      try {
        expect(e).toEqual({});
        expect(Object.keys(v)).toHaveLength(expectedSids.length);
        expectedSids.forEach((sid) => {
          expect(v[sid]).toBeDefined();
        });
        Object.values(v).forEach((value) => {
          expect(typeof value).toBe('number');
        });
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

test('(2 pts) all.status.get(random)', (done) => {
  distribution.mygroup.status.get('random', (e, v) => {
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

// This group is used for testing most of the functionality
const mygroupGroup = {};
// This group is used for {adding,removing} {groups,nodes}
const group4Group = {};

/*
   This hack is necessary since we can not
   gracefully stop the local listening node.
   This is because the process that node is
   running in is the actual jest process
*/

const n1 = {ip: '127.0.0.1', port: 8000};
const n2 = {ip: '127.0.0.1', port: 8001};
const n3 = {ip: '127.0.0.1', port: 8002};
const n4 = {ip: '127.0.0.1', port: 8003};
const n5 = {ip: '127.0.0.1', port: 8004};
const n6 = {ip: '127.0.0.1', port: 8005};


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
            });
          });
        });
      });
    });
  });

  mygroupGroup[id.getSID(n1)] = n1;
  mygroupGroup[id.getSID(n2)] = n2;
  mygroupGroup[id.getSID(n3)] = n3;

  group4Group[id.getSID(n1)] = n1;
  group4Group[id.getSID(n2)] = n2;
  group4Group[id.getSID(n4)] = n4;

  // Now, start the base listening node
  distribution.node.start((e) => {
    if (e) {
      done(e);
      return;
    }
    const groupInstantiation = (e, v) => {
      const mygroupConfig = {gid: 'mygroup'};
      const group4Config = {gid: 'group4'};

      // Create some groups
      distribution.local.groups
          .put(mygroupConfig, mygroupGroup, (e, v) => {
            distribution.local.groups
                .put(group4Config, group4Group, (e, v) => {
                  done();
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
});

afterAll((done) => {
  distribution.mygroup.status.stop((e, v) => {
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
});
