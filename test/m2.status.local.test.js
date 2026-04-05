require('../distribution.js')({ip: '127.0.0.1', port: 1246});
require('./helpers/sync-guard');
const distribution = globalThis.distribution;
const local = distribution.local;
const id = distribution.util.id;

const config = distribution.node.config;

test('(2 pts) local.status.get(sid)', (done) => {
  local.status.get('sid', (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(id.getSID(config));
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) local.status.get(nid)', (done) => {
  local.status.get('nid', (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(id.getNID(config));
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(2 pts) local.status.get(ip)', (done) => {
  local.status.get('ip', (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(config.ip);
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(2 pts) local.status.get(port)', (done) => {
  local.status.get('port', (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(config.port);
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(2 pts) local.status.get(counts)', (done) => {
  local.status.get('counts', (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toBeDefined();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(0 pts) local.status.get(counts) returns a number', (done) => {
  local.status.get('counts', (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(typeof v).toBe('number');
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(2 pts) local.status.get(random)', (done) => {
  local.status.get('random', (e, v) => {
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

test('(2 pts) local.status.get(heapTotal)', (done) => {
  const heapTotal = process.memoryUsage().heapTotal;

  local.status.get('heapTotal', (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toBeGreaterThanOrEqual(heapTotal);
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(2 pts) local.status.get(heapUsed)', (done) => {
  const heapUsed = process.memoryUsage().heapUsed;

  local.status.get('heapUsed', (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toBeGreaterThanOrEqual(heapUsed);
      done();
    } catch (error) {
      done(error);
    }
  });
});
