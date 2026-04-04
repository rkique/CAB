require('../distribution.js')();
require('./helpers/sync-guard');
const distribution = globalThis.distribution;
const id = distribution.util.id;

jest.spyOn(process, 'exit').mockImplementation((n) => { });

test('(1 pts) all.mem.put(jcarb)/mygroup.mem.get(jcarb)', (done) => {
  const user = {first: 'John', last: 'Carberry'};
  const key = 'jcarbmpmg';

  distribution.all.mem.put(user, key, (e, v) => {
    distribution.mygroup.mem.get(key, (e, v) => {
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

test('(1 pts) all.mem.get(jcarb)', (done) => {
  distribution.mygroup.mem.get('jcarb', (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) all.mem.del(jcarb)', (done) => {
  distribution.mygroup.mem.del('jcarb', (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) all.mem.put(jcarb)', (done) => {
  const user = {first: 'Josiah', last: 'Carberry'};
  const key = 'jcarbmp';

  distribution.mygroup.mem.put(user, key, (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(user);
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) all.mem.put/get(jcarb)', (done) => {
  const user = {first: 'Josiah', last: 'Carberry'};
  const key = 'jcarbmpg';

  distribution.mygroup.mem.put(user, key, (e, v) => {
    distribution.mygroup.mem.get(key, (e, v) => {
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

test('(1 pts) all.mem.put/del(jcarb)', (done) => {
  const user = {first: 'Josiah', last: 'Carberry'};
  const key = 'jcarbmpd';

  distribution.mygroup.mem.put(user, key, (e, v) => {
    distribution.mygroup.mem.del(key, (e, v) => {
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

test('(1 pts) all.mem.put/del/get(jcarb)', (done) => {
  const user = {first: 'Josiah', last: 'Carberry'};
  const key = 'jcarbmpdg';

  distribution.mygroup.mem.put(user, key, (e, v) => {
    distribution.mygroup.mem.del(key, (e, v) => {
      distribution.mygroup.mem.get(key, (e, v) => {
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

test('(1 pts) all.mem.put(no key)', (done) => {
  const user = {first: 'Josiah', last: 'Carberry'};

  distribution.mygroup.mem.put(user, null, (e, v) => {
    distribution.mygroup.mem.get(id.getID(user), (e, v) => {
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

// all.mem.put()/local.comm.send(mem.get())

test(
    '(1 pts) all.mem.put()/local.comm.send(mem.get())',
    (done) => {
      const user = {first: 'Gus', last: 'Fring'};
      const key = 'gfringmpcs';
      const kid = id.getID(key);
      const nodes = Object.values(group1Group);
      const nids = nodes.map((node) => id.getNID(node));

      distribution.group1.mem.put(user, key, (e, v) => {
        const nid = id.naiveHash(kid, nids);
        const pickedNode = nodes.filter((node) => id.getNID(node) === nid)[0];
        const remote = {node: pickedNode, service: 'mem', method: 'get'};
        const message = [{gid: 'group1', key: key}];

        distribution.local.comm.send(message, remote, (e, v) => {
          try {
            expect(e).toBeFalsy();
            expect(v).toEqual(user);
            done();
          } catch (error) {
            done(error);
          }
        });
      });
    },
);

test('(1 pts) all.mem.put()/othergroup.mem.get()', (done) => {
  const user = {first: 'Gus', last: 'Fring'};
  const key = 'gfringmpmg';

  distribution.all.mem.put(user, key, (e, v) => {
    distribution.mygroup.mem.get(key, (e, v) => {
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

test('(1 pts) all.mem.get()', (done) => {
  distribution.mygroup.mem.get('gfring', (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) all.mem.del()', (done) => {
  distribution.mygroup.mem.del('gfring', (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) all.mem.put()', (done) => {
  const user = {first: 'Gus', last: 'Fring'};
  const key = 'gfringmp';

  distribution.mygroup.mem.put(user, key, (e, v) => {
    expect(e).toBeFalsy();
    try {
      expect(v).toEqual(user);
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) all.mem.put/get()', (done) => {
  const user = {first: 'Gus', last: 'Fring'};
  const key = 'gfringmpg';

  distribution.mygroup.mem.put(user, key, (e, v) => {
    distribution.mygroup.mem.get(key, (e, v) => {
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

test('(1 pts) all.mem.put/del()', (done) => {
  const user = {first: 'Gus', last: 'Fring'};
  const key = 'gfringmpd';

  distribution.mygroup.mem.put(user, key, (e, v) => {
    distribution.mygroup.mem.del(key, (e, v) => {
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

test('(1 pts) all.mem.put/del/get()', (done) => {
  const user = {first: 'Gus', last: 'Fring'};
  const key = 'gfringmpdg';

  distribution.mygroup.mem.put(user, key, (e, v) => {
    distribution.mygroup.mem.del(key, (e, v) => {
      distribution.mygroup.mem.get(key, (e, v) => {
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

test('(3 pts) all.mem.put(no key)', (done) => {
  const user = {first: 'Gus', last: 'Fring'};

  distribution.mygroup.mem.put(user, null, (e, v) => {
    distribution.mygroup.mem.get(id.getID(user), (e, v) => {
      expect(e).toBeFalsy();
      try {
        expect(v).toEqual(user);
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});


test('(0 pts) putting to all.mem does not affect different groups', (done) => {
  const key = 'samekey';
  const a = {a: 1};
  const b = {b: 2};

  distribution.mygroup.mem.put(a, key, (e, v) => {
    if (e) return done(e);
    distribution.mygroup.mem.put(b, {key, gid: 'group1'}, (e, v) => {
      if (e) return done(e);
      distribution.mygroup.mem.get(key, (e, v) => {
        if (e) return done(e);
        expect(v).toEqual(a);
        done();
      });
    });
  });
});


/*
  Testing infrastructure code.
*/

// This group is used for testing most of the functionality
const mygroupGroup = {};
// These groups are used for testing hashing
const group1Group = {};
const group2Group = {};
const group3Group = {};
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

  group1Group[id.getSID(n4)] = n4;
  group1Group[id.getSID(n5)] = n5;
  group1Group[id.getSID(n6)] = n6;

  group2Group[id.getSID(n1)] = n1;
  group2Group[id.getSID(n3)] = n3;
  group2Group[id.getSID(n5)] = n5;

  group3Group[id.getSID(n2)] = n2;
  group3Group[id.getSID(n4)] = n4;
  group3Group[id.getSID(n6)] = n6;

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
      const group1Config = {gid: 'group1', hash: id.naiveHash};
      const group2Config = {gid: 'group2', hash: id.consistentHash};
      const group3Config = {gid: 'group3', hash: id.rendezvousHash};
      const group4Config = {gid: 'group4'};

      // Create some groups
      distribution.local.groups
          .put(mygroupConfig, mygroupGroup, (e, v) => {
            distribution.local.groups
                .put(group1Config, group1Group, (e, v) => {
                  distribution.local.groups
                      .put(group2Config, group2Group, (e, v) => {
                        distribution.local.groups
                            .put(group3Config, group3Group, (e, v) => {
                              distribution.local.groups
                                  .put(group4Config, group4Group, (e, v) => {
                                    distribution.mygroup.groups.put(group1Config, group1Group, (e, v) => {
                                      done();
                                    });
                                  });
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
