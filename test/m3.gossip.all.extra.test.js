require('../distribution.js')();
require('./helpers/sync-guard');
const distribution = globalThis.distribution;
const id = distribution.util.id;

jest.spyOn(process, 'exit').mockImplementation((n) => { });

// This group is used for testing most of the functionality
const mygroupGroup = {};

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


test('(30 pts) all.gossip.send()', (done) => {
  distribution.mygroup.groups.put('newgroup', {}, (e, v) => {
    if (e && Object.keys(e).length > 0) {
      done(e);
      return;
    }
    const newNode = {ip: '127.0.0.1', port: 4444};
    const message = [
      'newgroup',
      newNode,
    ];

    const remote = {service: 'groups', method: 'add'};
    distribution.mygroup.gossip.send(message, remote, (e, v) => {
      if (e && Object.keys(e).length > 0) {
        done(e);
        return;
      }
      setTimeout(() => {
        distribution.mygroup.groups.get('newgroup', (e, v) => {
          if (e && Object.keys(e).length > 0) {
            done(e);
            return;
          }
          let count = 0;
          for (const k in v) {
            if (Object.keys(v[k]).length > 0) {
              count++;
            }
          }
          /* Gossip only provides weak guarantees */
          try {
            expect(count).toBeGreaterThanOrEqual(2);
            done();
          } catch (error) {
            done(error);
          }
        });
      }, 500);
    });
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
            });
          });
        });
      });
    });
  });

  mygroupGroup[id.getSID(n1)] = n1;
  mygroupGroup[id.getSID(n2)] = n2;
  mygroupGroup[id.getSID(n3)] = n3;

  // Now, start the base listening node
  distribution.node.start((e) => {
    if (e) {
      done(e);
      return;
    }
    const groupInstantiation = (e, v) => {
      const mygroupConfig = {gid: 'mygroup'};

      // Create some groups
      distribution.local.groups
          .put(mygroupConfig, mygroupGroup, (e, v) => {
            if (e && Object.keys(e).length > 0) {
              done(e);
              return;
            }
            distribution.mygroup.groups.put(mygroupConfig, mygroupGroup, (e, v) => {
              if (e && Object.keys(e).length > 0) {
                done(e);
                return;
              }
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
