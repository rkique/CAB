/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/


const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');

const id = distribution.util.id;

const controller = { ip: '127.0.0.1', port: 9123 };
const n1 = { ip: '127.0.0.1', port: 9100 };
const n2 = { ip: '127.0.0.1', port: 9101 };
const nodes = [n1, n2];

function startAll(callback) {
  // Avoid port conflicts with other suites
  distribution.node.config.ip = controller.ip;
  distribution.node.config.port = controller.port;

  distribution.node.start(() => {
    function spawnStep(i) {
      if (i >= nodes.length) return callback();
      distribution.local.status.spawn(nodes[i], (e) => {
        if (e) return callback(e);
        spawnStep(i + 1);
      });
    }
    spawnStep(0);
  });
}

function stopAll(callback) {
  const remote = { service: 'status', method: 'stop' };

  function stopStep(i) {
    if (i >= nodes.length) return callback();
    remote.node = nodes[i];
    distribution.local.comm.send([], remote, () => stopStep(i + 1));
  }

  if (distribution.node.server) {
    try { distribution.node.server.close(); } catch (_) {}
  }
  stopStep(0);
}

beforeAll((done) => {
  stopAll(() => startAll(done));
});

afterAll((done) => {
  stopAll(done);
});

test('(1 pts) student test', (done) => {
  // local.comm.send defaults gid to 'local' if remote.gid is omitted
  distribution.local.comm.send(['nid'], { node: n1, service: 'status', method: 'get' }, (e, v) => {
    expect(e).toBeFalsy();
    expect(v).toBe(id.getNID(n1));
    done();
  });
});


test('(1 pts) student test', (done) => {
  // local.routes.get should accept either "status" or {service:"status", gid:"local"}
  distribution.local.routes.get('status', (e1, s1) => {
    expect(e1).toBeFalsy();
    distribution.local.routes.get({ service: 'status', gid: 'local' }, (e2, s2) => {
      expect(e2).toBeFalsy();
      expect(s2).toBe(s1);
      done();
    });
  });
});


test('(1 pts) student test', (done) => {
  // distributed comm should fan out to all nodes in the group and aggregate results
  const group = {};
  group[id.getSID(n1)] = n1;
  group[id.getSID(n2)] = n2;

  distribution.local.groups.put({ gid: 'studentG' }, group, (ePut) => {
    expect(ePut).toBeFalsy();

    distribution.studentG.comm.send(['nid'], { service: 'status', method: 'get' }, (e, v) => {
      // success should give empty error map and values for both nodes
      expect(e).toEqual({});
      expect(Object.keys(v).length).toBe(2);
      expect(Object.values(v)).toEqual(expect.arrayContaining([id.getNID(n1), id.getNID(n2)]));
      done();
    });
  });
});


test('(1 pts) student test', (done) => {
  // distributed status.get('heapUsed') should sum heapUsed across nodes
  const group = {};
  group[id.getSID(n1)] = n1;
  group[id.getSID(n2)] = n2;

  distribution.local.groups.put({ gid: 'studentH' }, group, (ePut) => {
    expect(ePut).toBeFalsy();

    // First get per-node heapUsed via distributed comm (local execution)
    distribution.studentH.comm.send(['heapUsed'], { service: 'status', method: 'get' }, (e1, perNode) => {
      expect(e1).toEqual({});

      const expectedSum = Object.values(perNode).reduce((acc, x) => acc + (typeof x === 'number' ? x : 0), 0);

      distribution.studentH.status.get('heapUsed', (e2, agg) => {
        expect(e2).toEqual({});
        expect(typeof agg).toBe('number');
        expect(agg).toBe(expectedSum);
        done();
      });
    });
  });
});

test('(1 pts) student test', (done) => {
  // distributed groups.get should return each node's view of a group
  const group = {};
  const sid1 = id.getSID(n1);
  const sid2 = id.getSID(n2);
  group[sid1] = n1;
  group[sid2] = n2;

  distribution.local.groups.put({ gid: 'studentV' }, group, (ePut) => {
    expect(ePut).toBeFalsy();

    distribution.studentV.groups.get('studentV', (e, views) => {
      expect(e).toEqual({});

      // views is { sidOfNode -> groupMapThatNodeReturned }
      expect(Object.keys(views)).toEqual(expect.arrayContaining([sid1, sid2]));

      expect(Object.keys(views[sid1])).toEqual(expect.arrayContaining([sid1, sid2]));
      expect(Object.keys(views[sid2])).toEqual(expect.arrayContaining([sid1, sid2]));

      done();
    });
  });
});