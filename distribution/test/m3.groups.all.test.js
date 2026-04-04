require('../distribution.js')();
require('./helpers/sync-guard');
const distribution = globalThis.distribution;
const id = distribution.util.id;

jest.spyOn(process, 'exit').mockImplementation((n) => { });

test('(3 pts) all.groups.del(random)', (done) => {
  distribution.group4.groups.del('random', (e, v) => {
    try {
      Object.keys(group4Group).forEach((sid) => {
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

test('(0 pts) all.groups.put/get(mygroup)', (done) => {
  const config = {gid: 'mygroup'};

  distribution.mygroup.groups.put(config, mygroupGroup, (e, v) => {
    distribution.mygroup.groups.get('mygroup', (e, v) => {
      try {
        expect(e).toEqual({});
        Object.keys(mygroupGroup).forEach((sid) => {
          expect(v[sid]).toBeDefined();
          Object.keys(mygroupGroup).forEach((memberSid) => {
            // Compare only ip and port to allow for auxiliary fields (e.g., onStart method)
            expect(v[sid][memberSid].ip).toEqual(mygroupGroup[memberSid].ip);
            expect(v[sid][memberSid].port).toEqual(mygroupGroup[memberSid].port);
          });
        });
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

test('(2 pts) all.groups.put(browncs)', (done) => {
  const g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '14ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.group4.groups.put('browncsgp', g, (e, v) => {
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

test('(2 pts) all.groups.put/get(browncs)', (done) => {
  const g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '14ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.group4.groups.put('browncsgpg', g, (e, v) => {
    distribution.group4.groups.get('browncsgpg', (e, v) => {
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
});

test('(3 pts) all.groups.put/get/del(browncs)', (done) => {
  const g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '14ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.group4.groups.put('browncsgpgd', g, (e, v) => {
    distribution.group4.groups.get('browncsgpgd', (e, v) => {
      distribution.group4.groups.del('browncsgpgd', (e, v) => {
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
  });
});

test('(3 pts) all.groups.put/get/del/get(browncs)', (done) => {
  const g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '14ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.group4.groups.put('browncsgpgdg', g, (e, v) => {
    distribution.group4.groups.get('browncsgpgdg', (e, v) => {
      distribution.group4.groups.del('browncsgpgdg', (e, v) => {
        distribution.group4.groups.get('browncsgpgdg', (e, v) => {
          try {
            expect(e).toBeDefined();
            Object.keys(group4Group).forEach((sid) => {
              expect(e[sid]).toBeInstanceOf(Error);
            });
            expect(v).toEqual({});
            done();
          } catch (error) {
            done(error);
          }
        });
      });
    });
  });
});

test('(3 pts) all.groups.put(dummy)/add(n1)/get(dummy)', (done) => {
  const g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '14ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.group4.groups.put('dummygpag', g, (e, v) => {
    const n1 = {ip: '127.0.0.1', port: 8082};

    distribution.group4.groups.add('dummygpag', n1, (e, v) => {
      const expectedGroup = {
        ...g, ...{[id.getSID(n1)]: n1},
      };

      distribution.group4.groups.get('dummygpag', (e, v) => {
        try {
          expect(e).toEqual({});
          Object.keys(group4Group).forEach((sid) => {
            expect(v[sid]).toEqual(expectedGroup);
          });
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
});

test('(3 pts) all.groups.put(dummy)/rem(n1)/get(dummy)', (done) => {
  const g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '14ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.group4.groups.put('dummygprg', g, (e, v) => {
    distribution.group4.groups.rem('dummygprg', '507aa', (e, v) => {
      const expectedGroup = {
        '14ab0': {ip: '127.0.0.1', port: 8081},
      };

      distribution.group4.groups.get('dummygprg', (e, v) => {
        try {
          expect(e).toEqual({});
          Object.keys(group4Group).forEach((sid) => {
            expect(v[sid]).toEqual(expectedGroup);
          });
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
});

test('(2 pts) all.groups.put()', (done) => {
  const g = {
    'al57j': {ip: '127.0.0.1', port: 9092},
    'q5mn9': {ip: '127.0.0.1', port: 9093},
  };

  distribution.group4.groups.put('atlas', g, (e, v) => {
    try {
      expect(e).toEqual({});
      expect(v[id.getSID(n1)]).toEqual(g);
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(3 pts) all.groups.put/get()', (done) => {
  const g = {
    'al57j': {ip: '127.0.0.1', port: 9092},
    'q5mn9': {ip: '127.0.0.1', port: 9093},
  };

  distribution.group4.groups.put('atlas', g, (e, v) => {
    distribution.group4.groups.get('atlas', (e, v) => {
      try {
        expect(e).toEqual({});
        expect(v[id.getSID(n1)]).toEqual(g);
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

test('(3 pts) all.groups.put/get/del()', (done) => {
  const g = {
    'al57j': {ip: '127.0.0.1', port: 9092},
    'q5mn9': {ip: '127.0.0.1', port: 9093},
  };

  distribution.group4.groups.put('atlas', g, (e, v) => {
    distribution.group4.groups.get('atlas', (e, v) => {
      distribution.group4.groups.del('atlas', (e, v) => {
        try {
          expect(e).toEqual({});
          expect(v[id.getSID(n1)]).toEqual(g);
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
});

test('(3 pts) all.groups.put/get/del/get()', (done) => {
  const g = {
    'al57j': {ip: '127.0.0.1', port: 9092},
    'q5mn9': {ip: '127.0.0.1', port: 9093},
  };

  distribution.group4.groups.put('atlas', g, (e, v) => {
    distribution.group4.groups.get('atlas', (e, v) => {
      distribution.group4.groups.del('atlas', (e, v) => {
        distribution.group4.groups.get('atlas', (e, v) => {
          try {
            expect(e).toBeDefined();
            Object.keys(e).forEach((k) => {
              expect(e[k]).toBeInstanceOf(Error);
              expect(v).toEqual({});
            });
            done();
          } catch (error) {
            done(error);
          }
        });
      });
    });
  });
});

test('(3 pts) all.groups.put()/add(n2)/get()', (done) => {
  const g = {
    'al57j': {ip: '127.0.0.1', port: 9092},
    'q5mn9': {ip: '127.0.0.1', port: 9093},
  };

  distribution.group4.groups.put('atlas', g, (e, v) => {
    const n2 = {ip: '127.0.0.1', port: 9094};

    distribution.group4.groups.add('atlas', n2, (e, v) => {
      const expectedGroup = {
        ...g, ...{[id.getSID(n2)]: n2},
      };

      distribution.group4.groups.get('atlas', (e, v) => {
        try {
          expect(e).toEqual({});
          expect(v[id.getSID(n1)]).toEqual(expectedGroup);
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
});

test('(3 pts) all.groups.put()/rem(n2)/get()', (done) => {
  const g = {
    'al57j': {ip: '127.0.0.1', port: 9092},
    'q5mn9': {ip: '127.0.0.1', port: 9093},
  };

  distribution.group4.groups.put('atlas', g, (e, v) => {
    distribution.group4.groups.rem('atlas', 'q5mn9', (e, v) => {
      const expectedGroup = {
        'al57j': {ip: '127.0.0.1', port: 9092},
      };

      distribution.group4.groups.get('atlas', (e, v) => {
        try {
          expect(e).toEqual({});
          expect(v[id.getSID(n1)]).toEqual(expectedGroup);
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
});

test('(0 pts) spawned node in all group', (done) => {
  const n7 = {ip: '127.0.0.1', port: 8006};

  // Stop the spawned node
  const cleanup = (cb) => {
    distribution.local.comm.send([], {service: 'status', method: 'stop', node: n7}, (e, v) => {
      cb(e, v);
    });
  };


  distribution.local.status.spawn(n7, (e, v) => {
    distribution.local.groups.get('all', (e, g) => {
      try {
        expect(e).toBeNull();
        expect(g[id.getSID(n7)].ip).toEqual(n7.ip);
        expect(g[id.getSID(n7)].port).toEqual(n7.port);
        cleanup(done);
      } catch (error) {
        cleanup(() => {
          done(error);
        });
      }
    });
  });
});

/* Infrastructure for the tests */

// This group is used for testing most of the functionality
const mygroupGroup = {};
// These groups are used for testing hashing
const group1Group = {};
const group2Group = {};
const group4Group = {};
const group3Group = {};

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

  group4Group[id.getSID(n1)] = n1;
  group4Group[id.getSID(n3)] = n3;
  group4Group[id.getSID(n5)] = n5;

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
                                    done();
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
