require('../distribution.js')();
require('./helpers/sync-guard');
const distribution = globalThis.distribution;
const id = distribution.util.id;

jest.spyOn(process, 'exit').mockImplementation((n) => { });

test('(1 pts) all.store.put(jcarb)/mygroup.store.get(jcarb)', (done) => {
  const user = {first: 'Josiah', last: 'Carberry'};
  const key = 'jcarbspsg';

  distribution.all.store.put(user, key, (e, v) => {
    distribution.mygroup.store.get(key, (e, v) => {
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

test('(1 pts) all.store.get(jcarb)', (done) => {
  distribution.mygroup.store.get('jcarb', (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) all.store.del(jcarb)', (done) => {
  distribution.mygroup.store.del('jcarb', (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) all.store.put(jcarb)', (done) => {
  const user = {first: 'Josiah', last: 'Carberry'};
  const key = 'jcarbmp';

  distribution.mygroup.store.put(user, key, (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(user);
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) all.store.put/get(jcarb)', (done) => {
  const user = {first: 'Josiah', last: 'Carberry'};
  const key = 'jcarbmpg';

  distribution.mygroup.store.put(user, key, (e, v) => {
    distribution.mygroup.store.get(key, (e, v) => {
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

test('(1 pts) all.store.put/del(jcarb)', (done) => {
  const user = {first: 'Josiah', last: 'Carberry'};
  const key = 'jcarbmpd';

  distribution.mygroup.store.put(user, key, (e, v) => {
    distribution.mygroup.store.del(key, (e, v) => {
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

test('(1 pts) all.store.put/del/get(jcarb)', (done) => {
  const user = {first: 'Josiah', last: 'Carberry'};
  const key = 'jcarbmpdg';

  distribution.mygroup.store.put(user, key, (e, v) => {
    distribution.mygroup.store.del(key, (e, v) => {
      distribution.mygroup.store.get(key, (e, v) => {
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

test('(6 pts) all.store.put(no key)', (done) => {
  const user = {first: 'Josiah', last: 'Carberry'};

  distribution.mygroup.store.put(user, null, (e, v) => {
    distribution.mygroup.store.get(id.getID(user), (e, v) => {
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

test('(2 pts) all.store.put(jcarb)/local.comm.send(store.get(jcarb))',
    (done) => {
      const user = {first: 'Josiah', last: 'Carberry'};
      const key = 'jcarbspcs';
      const kid = id.getID(key);
      const nodes = [n1, n2, n3, n4, n5];
      const nids = nodes.map((node) => id.getNID(node));

      distribution.mygroup.store.put(user, key, (e, v) => {
        const nid = id.naiveHash(kid, nids);
        const pickedNode = nodes.filter((node) => id.getNID(node) === nid)[0];
        const remote = {node: pickedNode, service: 'store', method: 'get'};
        const message = [{gid: 'mygroup', key: key}];

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


test(
    '(2 pts) all.store.put()/local.comm.send(store.get())',
    (done) => {
      const user = {first: 'Gus', last: 'Fring'};
      const key = 'gfringspcs';
      const kid = id.getID(key);
      const nodes = Object.values(mygroupBGroup);
      const nids = nodes.map((node) => id.getNID(node));

      distribution.mygroupB.store.put(user, key, (e, v) => {
        const nid = id.rendezvousHash(kid, nids);
        const pickedNode = nodes.filter((node) => id.getNID(node) === nid)[0];
        const remote = {node: pickedNode, service: 'store', method: 'get'};
        const message = [{gid: 'mygroupB', key: key}];

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

test('(1 pts) all.store.put()/othergroup.store.get()', (done) => {
  const user = {first: 'Gus', last: 'Fring'};
  const key = 'gfringspsg';

  distribution.all.store.put(user, key, (e, v) => {
    distribution.mygroupB.store.get(key, (e, v) => {
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

test('(1 pts) all.store.get()', (done) => {
  distribution.mygroupB.store.get('gfringsg', (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) all.store.del()', (done) => {
  distribution.mygroupB.store.del('gfringsd', (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) all.store.put()', (done) => {
  const user = {first: 'Gus', last: 'Fring'};
  const key = 'gfringsp';

  distribution.mygroupB.store.put(user, key, (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(user);
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) all.store.put/get()', (done) => {
  const user = {first: 'Gus', last: 'Fring'};
  const key = 'gfringspg';

  distribution.mygroupB.store.put(user, key, (e, v) => {
    distribution.mygroupB.store.get(key, (e, v) => {
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

test('(1 pts) all.store.put/del()', (done) => {
  const user = {first: 'Gus', last: 'Fring'};
  const key = 'gfringspd';

  distribution.mygroupB.store.put(user, key, (e, v) => {
    distribution.mygroupB.store.del(key, (e, v) => {
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

test('(1 pts) all.store.put/del/get()', (done) => {
  const user = {first: 'Gus', last: 'Fring'};
  const key = 'gfringspdg';

  distribution.mygroupB.store.put(user, key, (e, v) => {
    distribution.mygroupB.store.del(key, (e, v) => {
      distribution.mygroupB.store.get(key, (e, v) => {
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

test('(1 pts) all.store.put(no key)', (done) => {
  const user = {first: 'Gus', last: 'Fring'};

  distribution.mygroupB.store.put(user, null, (e, v) => {
    distribution.mygroupB.store.get(id.getID(user), (e, v) => {
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


test('(0 pts) putting to all.store does not affect different groups', (done) => {
  const key = 'key';
  const userA = {first: 'Alice', group: 'A'};
  const userB = {first: 'Bob', group: 'B'};

  distribution.mygroup.store.put(userA, key, (e) => {
    if (e) return done(e);
    distribution.mygroupB.store.put(userB, key, (e) => {
      if (e) return done(e);
      distribution.mygroup.store.get(key, (eA, vA) => {
        try {
          expect(eA).toBeFalsy();
          expect(vA).toEqual(userA);
        } catch (err) {
          return done(err);
        }

        distribution.mygroupB.store.get(key, (eB, vB) => {
          try {
            expect(eB).toBeFalsy();
            expect(vB).toEqual(userB);
            done();
          } catch (err) {
            done(err);
          }
        });
      });
    });
  });
});


/*
    Following is the setup for the tests.
*/

const mygroupGroup = {};
const mygroupBGroup = {};

/*
   This is necessary since we can not
   gracefully stop the local listening node.
   This is because the process that node is
   running in is the actual jest process
*/

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
    mygroupGroup[id.getSID(n1)] = n1;
    mygroupGroup[id.getSID(n2)] = n2;
    mygroupGroup[id.getSID(n3)] = n3;
    mygroupGroup[id.getSID(n4)] = n4;
    mygroupGroup[id.getSID(n5)] = n5;

    mygroupBGroup[id.getSID(n1)] = n1;
    mygroupBGroup[id.getSID(n2)] = n2;
    mygroupBGroup[id.getSID(n3)] = n3;
    mygroupBGroup[id.getSID(n4)] = n4;
    mygroupBGroup[id.getSID(n5)] = n5;

    // Now, start the nodes listening node
    distribution.node.start((e) => {
      if (e) {
        done(e);
        return;
      }
      const groupInstantiation = () => {
        const mygroupConfig = {gid: 'mygroup'};
        const mygroupBConfig = {gid: 'mygroupB', hash: id.rendezvousHash};

        // Create the groups
        distribution.local.groups.put(mygroupBConfig, mygroupBGroup, (e, v) => {
          distribution.local.groups.put(mygroupConfig, mygroupGroup, (e, v) => {
            distribution.mygroup.groups.put(mygroupConfig, mygroupGroup, (e, v) => {
              done();
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
