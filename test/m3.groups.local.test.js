require('../distribution.js')();
require('./helpers/sync-guard');
const distribution = globalThis.distribution;
const id = distribution.util.id;
const local = distribution.local;

test('(1 pts) local.groups.get(random)', (done) => {
  distribution.local.groups.get('random', (e, v) => {
    try {
      expect(e).toBeDefined();
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) local.groups.del(random)', (done) => {
  distribution.local.groups.del('random', (e, v) => {
    try {
      expect(e).toBeDefined();
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) local.groups.get(all) includes local node', (done) => {
  const localNode = distribution.node.config;
  const localSid = id.getSID(localNode);

  distribution.local.groups.get('all', (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v[localSid]).toEqual(localNode);
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) local.groups.put(browncs)', (done) => {
  const g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '12ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.local.groups.put('browncs', g, (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(g);
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) local.groups.add returns updated group', (done) => {
  const g = {};
  const node = {ip: '127.0.0.1', port: 8099};
  const sid = id.getSID(node);

  distribution.local.groups.put('addret', g, (e, v) => {
    distribution.local.groups.add('addret', node, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v[sid]).toEqual(node);
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

test('(2 pts) local.groups.put/get(browncs)', (done) => {
  const g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '12ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.local.groups.put('browncs', g, (e, v) => {
    distribution.local.groups.get('browncs', (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toEqual(g);
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

test('(0 pts) local.groups.del removes group from distribution', (done) => {
  const g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
  };

  distribution.local.groups.put('tempdel', g, (e, v) => {
    distribution.local.groups.del('tempdel', (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(globalThis.distribution.tempdel).toBeUndefined();
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

test('(2 pts) local.groups.put/get/del(browncs)', (done) => {
  const g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '12ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.local.groups.put('browncs', g, (e, v) => {
    distribution.local.groups.get('browncs', (e, v) => {
      distribution.local.groups.del('browncs', (e, v) => {
        try {
          expect(e).toBeFalsy();
          expect(v).toEqual(g);
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
});

test('(2 pts) local.groups.put/get/del/get(browncs)', (done) => {
  const g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '12ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.local.groups.put('browncs', g, (e, v) => {
    distribution.local.groups.get('browncs', (e, v) => {
      distribution.local.groups.del('browncs', (e, v) => {
        distribution.local.groups.get('browncs', (e, v) => {
          try {
            expect(e).toBeDefined();
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

test('(2 pts) local.groups.put(dummy)/add(n1)/get(dummy)', (done) => {
  const g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '12ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.local.groups.put('dummy', g, (e, v) => {
    const n1 = {ip: '127.0.0.1', port: 8082};

    distribution.local.groups.add('dummy', n1, (e, v) => {
      const expectedGroup = {
        ...g, ...{[id.getSID(n1)]: n1},
      };

      distribution.local.groups.get('dummy', (e, v) => {
        try {
          expect(e).toBeFalsy();
          expect(v).toEqual(expectedGroup);
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
});

test('(2 pts) local.groups.put(dummy)/rem(n1)/get(dummy)', (done) => {
  const g = {
    '507aa': {ip: '127.0.0.1', port: 8080},
    '12ab0': {ip: '127.0.0.1', port: 8081},
  };

  distribution.local.groups.put('dummy', g, (e, v) => {
    distribution.local.groups.rem('dummy', '507aa', (e, v) => {
      const expectedGroup = {
        '12ab0': {ip: '127.0.0.1', port: 8081},
      };

      distribution.local.groups.get('dummy', (e, v) => {
        try {
          expect(e).toBeFalsy();
          expect(v).toEqual(expectedGroup);
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
});

test('(0 pts) local.groups.add rejects missing group', (done) => {
  const n1 = {ip: '127.0.0.1', port: 8082};
  distribution.local.groups.add('missing', n1, (e, v) => {
    try {
      expect(e).toBeDefined();
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) local.groups.rem rejects missing group', (done) => {
  distribution.local.groups.rem('missing', '507aa', (e, v) => {
    try {
      expect(e).toBeDefined();
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(2 pts) local.groups.put()', (done) => {
  const g = {
    'al57j': {ip: '127.0.0.1', port: 8082},
    'q5mn8': {ip: '127.0.0.1', port: 8083},
  };

  local.groups.put('atlas', g, (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(g);
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(2 pts) local.groups.put/get()', (done) => {
  const g = {
    'al57j': {ip: '127.0.0.1', port: 8082},
    'q5mn8': {ip: '127.0.0.1', port: 8083},
  };

  local.groups.put('atlas', g, (e, v) => {
    local.groups.get('atlas', (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toEqual(g);
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

test('(2 pts) local.groups.put/get/del()', (done) => {
  const g = {
    'al57j': {ip: '127.0.0.1', port: 8082},
    'q5mn8': {ip: '127.0.0.1', port: 8083},
  };

  local.groups.put('atlas', g, (e, v) => {
    local.groups.get('atlas', (e, v) => {
      local.groups.del('atlas', (e, v) => {
        try {
          expect(e).toBeFalsy();
          expect(v).toEqual(g);
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
});

test('(2 pts) local.groups.put/get/del/get()', (done) => {
  const g = {
    'al57j': {ip: '127.0.0.1', port: 8082},
    'q5mn8': {ip: '127.0.0.1', port: 8083},
  };

  local.groups.put('atlas', g, (e, v) => {
    local.groups.get('atlas', (e, v) => {
      local.groups.del('atlas', (e, v) => {
        local.groups.get('atlas', (e, v) => {
          try {
            expect(e).toBeDefined();
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

test('(2 pts) local.groups.put()/add(n2)/get()', (done) => {
  const g = {
    'al57j': {ip: '127.0.0.1', port: 8082},
    'q5mn8': {ip: '127.0.0.1', port: 8083},
  };

  local.groups.put('atlas', g, (e, v) => {
    const n2 = {ip: '127.0.0.1', port: 8084};

    local.groups.add('atlas', n2, (e, v) => {
      const expectedGroup = {
        ...g, ...{[id.getSID(n2)]: n2},
      };

      local.groups.get('atlas', (e, v) => {
        try {
          expect(e).toBeFalsy();
          expect(v).toEqual(expectedGroup);
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
});

test('(2 pts) local.groups.put()/rem(n2)/get()', (done) => {
  const g = {
    'al57j': {ip: '127.0.0.1', port: 8082},
    'q5mn8': {ip: '127.0.0.1', port: 8083},
  };

  local.groups.put('atlas', g, (e, v) => {
    local.groups.rem('atlas', 'q5mn8', (e) => {
      const expectedGroup = {
        'al57j': {ip: '127.0.0.1', port: 8082},
      };

      local.groups.get('atlas', (e, v) => {
        try {
          expect(e).toBeFalsy();
          expect(v).toEqual(expectedGroup);
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
});
