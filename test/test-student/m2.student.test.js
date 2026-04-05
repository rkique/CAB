/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');

test('(1 pts) student test', (done) => {
  // Fill out this test case...
    distribution.local.status.get('nid', (e, nid) => {
      try{
        expect(e).toBeFalsy();
        expect(typeof nid).toBe('string');
        

        distribution.local.status.get('sid', (e, sid) => {
          expect(e).toBeFalsy();
          expect(typeof sid).toBe('string');

          distribution.local.status.get('heapUsed', (e,heap) => {
            expect(e).toBeFalsy();
            expect(typeof heap).toBe('number');
            done();
          });
        });
        } catch (err) {
          done(err);
        }
      });
    });


test('(1 pts) student test', (done) => {
  // Fill out this test case...
  const testService = {
    ping: (cb) => cb(null, 'pong'),
  };

  distribution.local.routes.put(testService, 'testService', (e, name) => {
    try {
      expect(e).toBeFalsy();
      expect(name).toBe('testService');

      distribution.local.routes.get('testService', (e, svc) => {
          expect(e).toBeFalsy();
          expect(name).toBe('testService');
            svc.ping((e, v) => {
              expect(e).toBeFalsy();
              expect(v).toBe('pong');
              done();
            });
          });
        } catch (err) {
          done(err);
        }
      });
    });



test('(1 pts) student test', (done) => {
  // Fill out this test case...
  const tempService = { f: (cb) => cb(null, 42) };

  distribution.local.routes.put(tempService, 'temp', () => {
    distribution.local.routes.rem('temp', (e, name) => {
      try{
        expect(e).toBeFalsy();
        expect(name).toBe(tempService);

        distribution.local.routes.get('temp', (e) => {
          expect(e).toBeTruthy();
          done();
        });
      } catch (err) {
        done(err);
      }
    })
  })
});

test('(1 pts) student test', (done) => {
  // Fill out this test case...
  distribution.node.start(() => {
    const node = distribution.node.config;

    distribution.local.comm.send(
      ['nid'],
      {node, service: 'status', method: 'get' },
      (e, v) => {
        try {
          expect(e).toBeFalsy();
          expect(typeof v).toBe('string');
          done();
        } catch (err) {
          done(err);
        }
      }
    );
  });
});

test('(1 pts) student test', (done) => {
  // Fill out this test case...
  const echoService = {
    echo: (msg, cb) => cb(null, msg),
  };

  distribution.node.start(() => {
    const node = distribution.node.config;

    distribution.local.routes.put(echoService, 'echoService', () => {
      distribution.local.comm.send(
        ['hello'],
        {node, service: 'echoService', method: 'echo' },
        (e, v) => {
          try{
            expect(e).toBeFalsy();
            expect(v).toBe('hello');
            done();
          } catch (err) {
            done(err);
          }
        }
      )
    })
  })
});
