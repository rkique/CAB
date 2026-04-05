/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');

test('(1 pts) student test', (done) => {
  const user = { first: 'Josiah', last: 'Carberry' };
  const key = 'jcarb_student_mem';

  globalThis.distribution.local.mem.put(user, key, (e1, v1) => {
    try {
      expect(e1).toBeFalsy();
      expect(v1).toEqual(user);
    } catch (err) {
      done(err);
      return;
    }

    globalThis.distribution.local.mem.get(key, (e2, v2) => {
      try {
        expect(e2).toBeFalsy();
        expect(v2).toEqual(user);
      } catch (err) {
        done(err);
        return;
      }

      globalThis.distribution.local.mem.del(key, (e3, v3) => {
        try {
          expect(e3).toBeFalsy();
          expect(v3).toEqual(user);
          done();
        } catch (err) {
          done(err);
        }
      });
    });
  });
});
  

test('(1 pts) student test', (done) => {
  const user = { first: 'Lavinia', last: 'Carberry' };
  const key = 'jcarb_student_store';

  globalThis.distribution.local.store.put(user, key, (e1, v1) => {
    try {
      expect(e1).toBeFalsy();
      expect(v1).toEqual(user);
    } catch (err) {
      done(err);
      return;
    }

    globalThis.distribution.local.store.get(key, (e2, v2) => {
      try {
        expect(e2).toBeFalsy();
        expect(v2).toEqual(user);
      } catch (err) {
        done(err);
        return;
      }

      globalThis.distribution.local.store.del(key, (e3, v3) => {
        try {
          expect(e3).toBeFalsy();
          expect(v3).toEqual(user);
          done();
        } catch (err) {
          done(err);
        }
      });
    });
  });
});


test('(1 pts) student test', (done) => {
  const d = globalThis.distribution;
  util = d.util;

  const n1 = { ip: '127.0.0.1', port: 9101 };
  const n2 = { ip: '127.0.0.1', port: 9102 };
  const gid = 'studentgrp';

  const group = {};
  group[util.id.getSID(n1)] = n1;
  group[util.id.getSID(n2)] = n2;

  const user = { first: 'Ada', last: 'Lovelace' };
  const key = 'student_distributed_key';

  const originalSend = d.local.comm.send;
  const remoteKV = new Map();

  d.local.comm.send = (message, remote, cb) => {
    try {
      expect(remote).toHaveProperty('service');
      expect(remote).toHaveProperty('method');
      expect(remote).toHaveProperty('node');

      expect(remote.service).toBe('store');

      if (remote.method === 'put') {
        const state = message[0];
        const cfg = message[1];
        expect(cfg).toEqual({ key, gid });
        remoteKV.set(cfg.key, state);
        return process.nextTick(() => cb(null, state));
      }

      if (remote.method === 'get') {
        const cfg = message[0];
        expect(cfg).toEqual({ key, gid });
        return process.nextTick(() => cb(null, remoteKV.get(cfg.key)));
      }

      return process.nextTick(() => cb(new Error('unexpected method')));
    } catch (err) {
      return process.nextTick(() => cb(err));
    }
  };

  d.local.groups.put({ gid, hash: util.id.naiveHash }, group, (e) => {
    if (e) {
      d.local.comm.send = originalSend;
      done(e);
      return;
    }

    d[gid].store.put(user, key, (e1, v1) => {
      try {
        expect(e1).toBeFalsy();
        expect(v1).toEqual(user);
      } catch (err) {
        d.local.comm.send = originalSend;
        done(err);
        return;
      }

      d[gid].store.get(key, (e2, v2) => {
        d.local.comm.send = originalSend; 
        try {
          expect(e2).toBeFalsy();
          expect(v2).toEqual(user);
          done();
        } catch (err) {
          done(err);
        }
      });
    });
  });
});

test('(1 pts) student test', (done) => {
  const nids = ['0a', '14', '1e']; 
  const kid = '0f';              
  const chosen = util.id.consistentHash(kid, nids);
  try {
    expect(chosen).toBe('14');
    done();
  } catch (err) {
    done(err);
  }
});

test('(1 pts) student test', (done) => {
  const kid = util.id.getID('somekey');
  const nids1 = ['aa', 'bb', 'cc', 'dd'];
  const nids2 = [...nids1].reverse();

  const a = util.id.rendezvousHash(kid, nids1);
  const b = util.id.rendezvousHash(kid, nids2);

  try {
    expect(nids1.includes(a)).toBe(true);
    expect(nids1.includes(b)).toBe(true);
    expect(a).toEqual(b); 
    done();
  } catch (err) {
    done(err);
  }
});
