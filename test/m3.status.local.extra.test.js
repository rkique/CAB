require('../distribution.js')();
require('./helpers/sync-guard');
const distribution = globalThis.distribution;
const local = distribution.local;
const comm = distribution.local.comm;
const spawnedNodes = [];

afterEach((done) => {
  const nodes = spawnedNodes.splice(0, spawnedNodes.length);

  const stopNext = (e) => {
    const node = nodes.shift();
    if (!node) {
      if (globalThis.distribution.node.server) {
        globalThis.distribution.node.server.close();
      }
      if (e) {
        done(e);
        return;
      }
      done();
      return;
    }

    comm.send([], {service: 'status', method: 'stop', node: node}, (e) => {
      stopNext(e);
    });
  };

  stopNext();
});

test('(10 pts) local.status.spawn/stop using local.comm', (done) => {
  try {
    expect(local.status.spawn).toBeDefined();
    expect(local.status.stop).toBeDefined();
    expect(local.comm).toBeDefined();
    expect(local.comm.send).toBeDefined();
  } catch (error) {
    done(error);
  }

  const node = {
    ip: '127.0.0.1',
    port: 9090,
  };

  const config = {
    ip: node.ip,
    port: node.port,
    onStart: () => {
    },
  };

  const spawnNode = () => {
    local.status.spawn(config, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toBeDefined();
        spawnedNodes.push(node);
        done();
      } catch (error) {
        done(error);
      }
    });
  };

  distribution.node.start((e) => {
    if (e) {
      done(e);
      return;
    }
    spawnNode();
  });
});

test('(0 pts) local.status.spawn returns error when port already in use', (done) => {
  const node = {
    ip: '127.0.0.1',
    port: 9123,
  };

  distribution.node.start((e) => {
    if (e) {
      done(e);
      return;
    }
    local.status.spawn(node, (e, v) => {
      if (e) {
        done(e);
        return;
      }
      spawnedNodes.push(node);
      local.status.spawn(node, (e, v) => {
        try {
          expect(e).toBeDefined();
          expect(v).toBeFalsy();
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
});

test('(0 pts) local.status.spawn returns error on duplicate spawn', (done) => {
  const node = {
    ip: '127.0.0.1',
    port: 9124,
  };

  distribution.node.start((e) => {
    if (e) {
      done(e);
      return;
    }
    local.status.spawn(node, (e, v) => {
      if (e) {
        done(e);
        return;
      }
      spawnedNodes.push(node);
      local.status.spawn(node, (e, v) => {
        try {
          expect(e).toBeDefined();
          expect(v).toBeFalsy();
          done();
        } catch (error) {
          done(error);
        }
      });
    });
  });
});

test('(0 pts) local.status.spawn with invalid config', (done) => {
  const config = {
    ip: '127.0.0.1',
    port: 0, // Port cannot be 0
  };

  local.status.spawn(config, (e, v) => {
    try {
      expect(e).toBeDefined();
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});
