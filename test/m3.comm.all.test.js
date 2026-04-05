require('../distribution.js')();
require('./helpers/sync-guard');
const distribution = globalThis.distribution;
const id = distribution.util.id;

const mygroupConfig = {gid: 'mygroup'};
const mygroupGroup = {};

const n1 = {ip: '127.0.0.1', port: 9001};
const n2 = {ip: '127.0.0.1', port: 9002};
const n3 = {ip: '127.0.0.1', port: 9003};
const n4 = {ip: '127.0.0.1', port: 9004};
const n5 = {ip: '127.0.0.1', port: 9005};
const n6 = {ip: '127.0.0.1', port: 9006};

test('(2 pts) all.comm.send(status.get(nid))', (done) => {
  const nids = Object.values(mygroupGroup).map((node) => id.getNID(node));
  const remote = {service: 'status', method: 'get'};

  distribution.mygroup.comm.send(['nid'], remote, (e, v) => {
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

test('(2 pts) all.comm.send(status.get(random))', (done) => {
  const remote = {service: 'status', method: 'get'};

  distribution.mygroup.comm.send(['random'], remote, (e, v) => {
    try {
      Object.keys(mygroupGroup).forEach((sid) => {
        expect(e[sid]).toBeDefined();
        expect(e[sid]).toBeInstanceOf(Error);
        expect(v).toEqual({});
      });

      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) all.comm.send fails for empty group', (done) => {
  const emptyConfig = {gid: 'empty'};
  distribution.local.groups.put(emptyConfig, {}, (e, v) => {
    if (e) {
      done(e);
      return;
    }
    distribution.empty.comm.send([], {service: 'status', method: 'get'}, (err, val) => {
      distribution.local.groups.del('empty', () => {
        try {
          expect(err).toBeInstanceOf(Error);
          expect(val).toBeFalsy();
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
});

test('(0 pts) all.comm.send rejects missing service', (done) => {
  const remote = {method: 'get'};

  distribution.mygroup.comm.send([], remote, (e, v) => {
    try {
      const sids = Object.keys(mygroupGroup);
      expect(Object.keys(e).length).toEqual(sids.length);
      sids.forEach((sid) => {
        expect(e[sid]).toBeInstanceOf(Error);
      });
      expect(v).toEqual({});
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) all.comm.send rejects missing method', (done) => {
  const remote = {service: 'status'};

  distribution.mygroup.comm.send([], remote, (e, v) => {
    try {
      const sids = Object.keys(mygroupGroup);
      expect(Object.keys(e).length).toEqual(sids.length);
      sids.forEach((sid) => {
        expect(e[sid]).toBeInstanceOf(Error);
      });
      expect(v).toEqual({});
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) all.comm.send rejects non-array message', (done) => {
  const remote = {service: 'status', method: 'get'};

  distribution.mygroup.comm.send('not-an-array', remote, (e, v) => { // @ts-ignore for test
    try {
      const sids = Object.keys(mygroupGroup);
      expect(Object.keys(e).length).toEqual(sids.length);
      sids.forEach((sid) => {
        expect(e[sid]).toBeInstanceOf(Error);
      });
      expect(v).toEqual({});
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) all.comm.send with undefined message returns error per node', (done) => {
  const remote = {service: 'status', method: 'get'};

  distribution.mygroup.comm.send(undefined, remote, (e, v) => {
    try {
      const sids = Object.keys(mygroupGroup);
      expect(Object.keys(e).length).toEqual(sids.length);
      sids.forEach((sid) => {
        expect(e[sid]).toBeInstanceOf(Error);
      });
      expect(v).toEqual({});
      done();
    } catch (error) {
      done(error);
    }
  });
});

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


    const groupInstantiation = () => {
      // Create the groups
      distribution.local.groups
          .put(mygroupConfig, mygroupGroup, (e, v) => {
            if (e) {
              done(e);
              return;
            }
            done();
          });
    };


    // Now, start the nodes listening node
    distribution.node.start((e) => {
      if (e) {
        done(e);
        return;
      }
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
