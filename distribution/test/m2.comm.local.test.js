require('../distribution.js')({ip: '127.0.0.1', port: 1246});
require('./helpers/sync-guard');
const http = require('node:http');
const proc = require('node:child_process');
const distribution = globalThis.distribution;
const local = distribution.local;
const id = distribution.util.id;

test('(10 pts) local.comm(status.get(nid))', (done) => {
  const node = distribution.node.config;

  const remote = {node: node, service: 'status', method: 'get'};
  const message = ['nid']; // Arguments to the method

  local.comm.send(message, remote, (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(id.getNID(node));
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(10 pts) comm: status.get()', (done) => {
  const node = distribution.node.config;
  const remote = {node: node, service: 'status', method: 'get'};
  const message = [
    'sid',
  ];

  local.comm.send(message, remote, (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(id.getSID(node));
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) comm defaults gid to local', (done) => {
  const node = distribution.node.config;
  const remote = {node: node, service: 'status', method: 'get'};
  const message = ['nid'];

  local.comm.send(message, remote, (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(id.getNID(node));
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(10 pts) comm: status.get() with nonexistent key', (done) => {
  const node = distribution.node.config;
  const remote = {node: node, service: 'status', method: 'get'};
  const message = ['invalid'];

  local.comm.send(message, remote, (e, v) => {
    try {
      expect(e).toBeTruthy();
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(10 pts) comm: status.get() with invalid service', (done) => {
  const node = distribution.node.config;
  const remote = {node: node, service: 'invalid', method: 'get'};
  const message = ['sid'];

  local.comm.send(message, remote, (e, v) => {
    try {
      expect(e).toBeTruthy();
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) comm: send rejects missing node', (done) => {
  const remote = {service: 'status', method: 'get'};

  local.comm.send([], remote, (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) comm: send rejects node with missing IP', (done) => {
  const remote = {
    node: {
      port: 1000,
    },
    service: 'status',
    method: 'get',
  };

  local.comm.send([], remote, (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) comm: send rejects node with missing port', (done) => {
  const remote = {
    node: {
      ip: '0.0.0.0',
    },
    service: 'status',
    method: 'get',
  };

  local.comm.send([], remote, (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) comm: send requires service and method', (done) => {
  const node = distribution.node.config;
  const remoteMissingService = {node: node, method: 'get'};
  const remoteMissingMethod = {node: node, service: 'status'};

  local.comm.send([], remoteMissingService, (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      local.comm.send([], remoteMissingMethod, (e2, v2) => {
        try {
          expect(e2).toBeInstanceOf(Error);
          expect(v2).toBeFalsy();
          done();
        } catch (error) {
          done(error);
        }
      });
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) comm: send rejects empty service string', (done) => {
  const node = distribution.node.config;
  const remote = {node: node, service: '', method: 'get'};

  local.comm.send([], remote, (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) comm: send rejects empty method string', (done) => {
  const node = distribution.node.config;
  const remote = {node: node, service: 'status', method: ''};

  local.comm.send([], remote, (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) comm: send rejects non-array message', (done) => {
  const node = distribution.node.config;
  const remote = {node: node, service: 'status', method: 'get'};

  local.comm.send('not-an-array', remote, (e, v) => { // @ts-ignore for test
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) comm: send rejects non-array object message', (done) => {
  const node = distribution.node.config;
  const remote = {node: node, service: 'status', method: 'get'};

  local.comm.send({0: 'sid', length: 1}, remote, (e, v) => { // @ts-ignore for test
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) comm: send with undefined message returns error from service', (done) => {
  const node = distribution.node.config;
  const remote = {node: node, service: 'status', method: 'get'};

  local.comm.send(undefined, remote, (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) comm: send with null message returns error from service', (done) => {
  const node = distribution.node.config;
  const remote = {node: node, service: 'status', method: 'get'};

  local.comm.send(null, remote, (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) comm: send with invalid remote address returns error from service', (done) => {
  const remote = {
    node: {
      ip: 'invalid',
      port: 1000,
    },
    service: 'status',
    method: 'get',
  };

  local.comm.send([], remote, (e, v) => {
    try {
      expect(e?.constructor?.name).toBe('Error');
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) node starts when called without configuration', (done) => {
  const child = proc.spawn('./distribution.js');

  setTimeout(() => {
    child.kill();
  }, 1000);

  child.on('exit', (code, signal) => {
    expect(signal).toBe('SIGTERM');
    done();
  });
});

test('(0 pts) node starts when called with serialized configuration', (done) => {
  const config = {ip: '127.0.0.1', port: 3000};
  const child = proc.spawn('./distribution.js', [
    '--config',
    globalThis.distribution.util.serialize(config),
  ]);

  setTimeout(() => {
    child.kill();
  }, 1000);

  child.on('exit', (code, signal) => {
    expect(signal).toBe('SIGTERM');
    done();
  });
});

test('(0 pts) node starts when called with JSON configuration', (done) => {
  const config = {ip: '127.0.0.1', port: 3000};
  const child = proc.spawn('./distribution.js', [
    '--config',
    JSON.stringify(config),
  ]);

  setTimeout(() => {
    child.kill();
  }, 1000);

  child.on('exit', (code, signal) => {
    expect(signal).toBe('SIGTERM');
    done();
  });
});

test('(0 pts) node exits when called with invalid configuration', (done) => {
  const child = proc.spawn('./distribution.js', ['--config', 'invalid']);

  setTimeout(() => {
    child.kill();
  }, 500);

  child.on('exit', (code, signal) => {
    expect(code).toBe(1);
    done();
  });
});

test('(0 pts) node HTTP server is set in the global object', (done) => {
  expect(globalThis.distribution.node.server).toBeInstanceOf(http.Server);
  done();
});

test('(0 pts) node responds with serialized error on non-PUT', (done) => {
  const node = distribution.node.config;
  const options = {
    hostname: node.ip,
    port: node.port,
    path: '/local/status/get',
    method: 'GET',
  };

  const request = http.request(options, (response) => {
    let data = '';
    response.on('data', (chunk) => {
      data += chunk;
    });
    response.on('end', () => {
      try {
        const error = distribution.util.deserialize(data);
        expect(error).toBeInstanceOf(Error);
        done();
      } catch (err) {
        done(err);
      }
    });
  });

  request.on('error', (err) => {
    done(err);
  });

  request.end();
});

test('(0 pts) node responds with [err, value] for success', (done) => {
  const node = distribution.node.config;
  const options = {
    hostname: node.ip,
    port: node.port,
    path: '/local/status/get',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const request = http.request(options, (response) => {
    let data = '';
    response.on('data', (chunk) => {
      data += chunk;
    });
    response.on('end', () => {
      try {
        const decoded = distribution.util.deserialize(data);
        expect(Array.isArray(decoded)).toBe(true);
        expect(decoded.length).toBe(2);
        expect(decoded[0]).toBeFalsy();
        expect(decoded[1]).toEqual(id.getNID(node));
        done();
      } catch (err) {
        done(err);
      }
    });
  });

  request.on('error', (err) => {
    done(err);
  });

  request.write(distribution.util.serialize(['nid']));
  request.end();
});

test('(0 pts) node responds with [err, null] for missing method', (done) => {
  const node = distribution.node.config;
  const options = {
    hostname: node.ip,
    port: node.port,
    path: '/local/status/does-not-exist',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const request = http.request(options, (response) => {
    let data = '';
    response.on('data', (chunk) => {
      data += chunk;
    });
    response.on('end', () => {
      try {
        const decoded = distribution.util.deserialize(data);
        expect(Array.isArray(decoded)).toBe(true);
        expect(decoded.length).toBe(2);
        expect(decoded[0]).toBeInstanceOf(Error);
        expect(decoded[1]).toBeNull();
        done();
      } catch (err) {
        done(err);
      }
    });
  });

  request.on('error', (err) => {
    done(err);
  });

  request.write(distribution.util.serialize([]));
  request.end();
});

/* Test infrastructure */

beforeAll((done) => {
  distribution.node.start((e) => {
    if (e) {
      done(e);
      return;
    }
    done();
  });
});

afterAll((done) => {
  if (globalThis.distribution.node.server) {
    globalThis.distribution.node.server.close();
  }
  done();
});
