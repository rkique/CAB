require('../distribution.js')();
require('./helpers/sync-guard');
const distribution = globalThis.distribution;
const id = distribution.util.id;


test('(3 pts) all.store.get(no key)', (done) => {
  const users = [
    {first: 'Emma', last: 'Watson'},
    {first: 'John', last: 'Krasinski'},
    {first: 'Julie', last: 'Bowen'},
  ];
  const keys = [
    'ewatsonsgnk',
    'jkrasinskisgnk',
    'jbowensgnk',
  ];

  distribution.mygroup.store.put(users[0], keys[0], (e, v) => {
    if (e) {
      done(e);
      return;
    }
    distribution.mygroup.store.put(users[1], keys[1], (e, v) => {
      if (e) {
        done(e);
        return;
      }
      distribution.mygroup.store.put(users[2], keys[2], (e, v) => {
        if (e) {
          done(e);
          return;
        }
        distribution.mygroup.store.get(null, (e, v) => {
          try {
            expect(e).toEqual({});
            expect(Object.values(v)).toEqual(expect.arrayContaining(keys));
            done();
          } catch (error) {
            done(error);
          }
        });
      });
    });
  });
});

test('(1 pts) all.store.get(no key)', (done) => {
  const users = [
    {first: 'Saul', last: 'Goodman'},
    {first: 'Walter', last: 'White'},
    {first: 'Jesse', last: 'Pinkman'},
  ];
  const keys = [
    'sgoodmansgnk',
    'jkrasinskisgnk',
    'jbowensgnk',
  ];

  distribution.mygroup.store.put(users[0], keys[0], (e, v) => {
    if (e) {
      done(e);
      return;
    }
    distribution.mygroup.store.put(users[1], keys[1], (e, v) => {
      if (e) {
        done(e);
        return;
      }
      distribution.mygroup.store.put(users[2], keys[2], (e, v) => {
        if (e) {
          done(e);
          return;
        }
        distribution.mygroup.store.get(null, (e, v) => {
          try {
            expect(e).toEqual({});
            expect(Object.values(v)).toEqual(expect.arrayContaining(keys));
            done();
          } catch (error) {
            done(error);
          }
        });
      });
    });
  });
});

test('(12 pts) all.store.reconf', (done) => {
  /*
       NOTE: If this test fails locally,
       make sure you delete the contents of the store/ directory (not the directory itself!),
       so your results are reproducible.
   */

  // First, we check where the keys should be placed
  // before we change the group's nodes.
  // mygroup uses the specified hash function for item placement,
  // so we test using the same hash function
  const users = [
    {first: 'Emma', last: 'Watson'},
    {first: 'John', last: 'Krasinski'},
    {first: 'Julie', last: 'Bowen'},
    {first: 'Sasha', last: 'Spielberg'},
    {first: 'Tim', last: 'Nelson'},
  ];
  const keys = [
    'a',
    'b',
    'c',
    'd',
    'e',
  ];

  const expectedGroup = {...mygroupGroup};
  delete expectedGroup[id.getSID(n3)];
  const expectedNids = Object.values(expectedGroup).map((node) => id.getNID(node));

  const expectedNodeForKey = (key) => {
    const kid = id.getID(key);
    const nid = id.naiveHash(kid, expectedNids);
    return expectedGroup[nid.substring(0, 5)];
  };

  // This function will be called after we put items in nodes
  const checkPlacement = (e, v) => {
    try {
      const messages = [
        [{key: keys[0], gid: 'mygroup'}],
        [{key: keys[1], gid: 'mygroup'}],
        [{key: keys[2], gid: 'mygroup'}],
        [{key: keys[3], gid: 'mygroup'}],
        [{key: keys[4], gid: 'mygroup'}],
      ];

      distribution.local.comm.send(
          messages[0],
          {node: expectedNodeForKey(keys[0]), service: 'store', method: 'get'},
          (e, v) => {
            try {
              expect(e).toBeFalsy();
              expect(v).toEqual(users[0]);
            } catch (error) {
              done(error);
            }

            distribution.local.comm.send(
                messages[1],
                {node: expectedNodeForKey(keys[1]), service: 'store', method: 'get'},
                (e, v) => {
                  try {
                    expect(e).toBeFalsy();
                    expect(v).toEqual(users[1]);
                  } catch (error) {
                    done(error);
                  }

                  distribution.local.comm.send(
                      messages[2],
                      {node: expectedNodeForKey(keys[2]), service: 'store', method: 'get'},
                      (e, v) => {
                        try {
                          expect(e).toBeFalsy();
                          expect(v).toEqual(users[2]);
                        } catch (error) {
                          done(error);
                        }

                        distribution.local.comm.send(
                            messages[3],
                            {node: expectedNodeForKey(keys[3]), service: 'store', method: 'get'},
                            (e, v) => {
                              try {
                                expect(e).toBeFalsy();
                                expect(v).toEqual(users[3]);
                              } catch (error) {
                                done(error);
                              }

                              distribution.local.comm.send(
                                  messages[4],
                                  {node: expectedNodeForKey(keys[4]), service: 'store', method: 'get'},
                                  (e, v) => {
                                    try {
                                      expect(e).toBeFalsy();
                                      expect(v).toEqual(users[4]);
                                      done();
                                    } catch (error) {
                                      done(error);
                                    }
                                  });
                            });
                      });
                });
          });
    } catch (error) {
      done(error);
    }
  };

  // Now we actually put items in the group,
  // remove n5, and check if the items are placed correctly
  distribution.mygroup.store.put(users[0], keys[0], (e, v) => {
    if (e) {
      done(e);
      return;
    }
    distribution.mygroup.store.put(users[1], keys[1], (e, v) => {
      if (e) {
        done(e);
        return;
      }
      distribution.mygroup.store.put(users[2], keys[2], (e, v) => {
        if (e) {
          done(e);
          return;
        }
        distribution.mygroup.store.put(users[3], keys[3], (e, v) => {
          if (e) {
            done(e);
            return;
          }
          distribution.mygroup.store.put(users[4], keys[4], (e, v) => {
            if (e) {
              done(e);
              return;
            }
            // We need to pass a copy of the group's
            // nodes before we call reconf()
            const groupCopy = {...mygroupGroup};

            // Then, we remove n3 from the list of nodes,
            // and run reconf() with the new list of nodes
            // Note: In this scenario, we are removing a node that has no items in it.
            distribution.local.groups.rem('mygroup', id.getSID(n3), (e, v) => {
              if (e && Object.keys(e).length > 0) {
                done(e);
                return;
              }
              distribution.mygroup.groups.rem(
                  'mygroup',
                  id.getSID(n3),
                  (e, v) => {
                    if (e && Object.keys(e).length > 0) {
                      done(e);
                      return;
                    }
                    distribution.mygroup.store.reconf(groupCopy, (e, v) => {
                      if (e) {
                        done(e);
                        return;
                      }
                      checkPlacement();
                    });
                  });
            });
          });
        });
      });
    });
  });
});

/*
    Following is the setup for the tests.
*/

const mygroupGroup = {};

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

    // Now, start the nodes listening node
    distribution.node.start((e) => {
      if (e) {
        done(e);
        return;
      }
      const groupInstantiation = () => {
        const mygroupConfig = {gid: 'mygroup'};

        // Create the groups
        distribution.local.groups.put(mygroupConfig, mygroupGroup, (e, v) => {
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
