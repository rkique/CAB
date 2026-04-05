require('../distribution.js')();
require('./helpers/sync-guard');
const distribution = globalThis.distribution;
const id = distribution.util.id;

jest.spyOn(process, 'exit').mockImplementation((n) => { });

test('(2 pts) all.routes.put()', (done) => {
  const gotchaService = {};

  gotchaService.gotcha = () => {
    return 'gotcha!';
  };

  distribution.mygroup.routes.put(gotchaService,
      'gotcha', (e, v) => {
        const n1 = {ip: '127.0.0.1', port: 8000};
        const n2 = {ip: '127.0.0.1', port: 8001};
        const n3 ={ip: '127.0.0.1', port: 8002};
        const r1 = {node: n1, service: 'routes', method: 'get'};
        const r2 = {node: n2, service: 'routes', method: 'get'};
        const r3 = {node: n3, service: 'routes', method: 'get'};

        distribution.local.comm.send(['gotcha'], r1, (e, v) => {
          try {
            expect(e).toBeFalsy();
            expect(v.gotcha()).toEqual('gotcha!');
          } catch (error) {
            done(error);
            return;
          }
          distribution.local.comm.send(['gotcha'], r2, (e, v) => {
            try {
              expect(e).toBeFalsy();
              expect(v.gotcha()).toEqual('gotcha!');
            } catch (error) {
              done(error);
              return;
            }
            distribution.local.comm.send(['gotcha'], r3, (e, v) => {
              expect(e).toBeFalsy();
              try {
                expect(v.gotcha()).toEqual('gotcha!');
                done();
              } catch (error) {
                done(error);
                return;
              }
            });
          });
        });
      });
});

test('(2 pts) all.routes.put(echo)', (done) => {
  const echoService = {};

  echoService.echo = () => {
    return 'echo!';
  };

  distribution.mygroup.routes.put(echoService, 'echo', (e, v) => {
    // test all different ways the local.routes.get() can accept configs
    const r1 = {node: n1, service: 'routes', method: 'get', gid: 'local'};
    const r2 = {node: n2, service: 'routes', method: 'get'};
    const r3 = {node: n3, service: 'routes', method: 'get'};

    distribution.local.comm.send(['echo'], r1, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v.echo()).toEqual('echo!');
      } catch (error) {
        done(error);
        return;
      }
      distribution.local.comm.send([{service: 'echo'}], r2, (e, v) => {
        try {
          expect(e).toBeFalsy();
          expect(v.echo()).toEqual('echo!');
        } catch (error) {
          done(error);
          return;
        }
        distribution.local.comm.send([{service: 'echo', gid: 'local'}], r3, (e, v) => {
          try {
            expect(e).toBeFalsy();
            expect(v.echo()).toEqual('echo!');
            done();
          } catch (error) {
            done(error);
            return;
          }
        });
      });
    });
  });
});

test('(0 pts) all.routes.rem removes remote service', (done) => {
  const tempService = {hello: () => 'world'};
  const r1 = {node: n1, service: 'routes', method: 'get'};
  const r2 = {node: n2, service: 'routes', method: 'get'};
  const r3 = {node: n3, service: 'routes', method: 'get'};

  distribution.mygroup.routes.put(tempService, 'temp', (e, v) => {
    distribution.mygroup.routes.rem('temp', (e, v) => {
      distribution.local.comm.send(['temp'], r1, (e, v) => {
        try {
          expect(e).toBeInstanceOf(Error);
          expect(v).toBeFalsy();
        } catch (error) {
          done(error);
          return;
        }
        distribution.local.comm.send(['temp'], r2, (e, v) => {
          try {
            expect(e).toBeInstanceOf(Error);
            expect(v).toBeFalsy();
          } catch (error) {
            done(error);
            return;
          }
          distribution.local.comm.send(['temp'], r3, (e, v) => {
            try {
              expect(e).toBeInstanceOf(Error);
              expect(v).toBeFalsy();
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

/* Testing infrastructure code */

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
