const config = {ip: '127.0.0.1', port: 2345};
require('../distribution.js')(config);
require('./helpers/sync-guard');
const distribution = globalThis.distribution;
const local = distribution.local;
const routes = distribution.local.routes;

test('(4 pts) local.routes.get(status)', (done) => {
  const status = local.status;

  local.routes.get('status', (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(status);
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(4 pts) local.routes.get(routes)', (done) => {
  local.routes.get('routes', (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(routes);
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(4 pts) local.routes.get(comm)', (done) => {
  const comm = local.comm;

  local.routes.get('comm', (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(comm);
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(3 pts) local.routes.get(random)', (done) => {
  local.routes.get('random', (e, v) => {
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

test('(6 pts) local.routes.put/get(echo)', (done) => {
  const echoService = {};

  echoService.echo = () => {
    return 'echo!';
  };

  local.routes.put(echoService, 'echo', (e, v) => {
    local.routes.get('echo', (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v.echo()).toEqual('echo!');
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

test('(8 pts) routes: put() -> get()', (done) => {
  const otherService = {};

  otherService.gotcha = () => {
    return 'gotcha!';
  };

  routes.put(otherService, 'other', (e, v) => {
    routes.get('other', (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v.gotcha()).toEqual('gotcha!');
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

test('(0 pts) local.routes.rem removes service', (done) => {
  const tempService = {};
  tempService.hello = () => 'world';

  routes.put(tempService, 'temp', (e, v) => {
    routes.rem('temp', (e, v) => {
      routes.get('temp', (e, v) => {
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

test('(0 pts) local.routes.rem returns removed service', (done) => {
  const tempService = {};
  tempService.hello = () => 'world';

  routes.put(tempService, 'temp-return', (e, v) => {
    routes.rem('temp-return', (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toBe(tempService);
        done();
      } catch (error) {
        done(error);
      }
    });
  });
});

test('(3 pts) comm: routes.get()', (done) => {
  const remote = {node: config, service: 'routes', method: 'get'};
  const message = ['status'];
  distribution.node.start((e) => {
    if (e) {
      done(e);
      return;
    }
    //send message to the routes service on this node to get the status service.
    local.comm.send(message, remote, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toBeDefined();
        done();
      } catch (error) {
        done(error);
      } finally {
        if (globalThis.distribution.node.server) {
          globalThis.distribution.node.server.close();
        }
      }
    });
  });
});

test('(0 pts) routes.get: handle null routes', (done) => {
  local.routes.get(null, (e, v) => {
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

test('(0 pts) local.routes.get({service, gid: local}) returns local service', (done) => {
  local.routes.get({service: 'status', gid: 'local'}, (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toBe(local.status);
      done();
    } catch (error) {
      done(error);
    }
  });
});
