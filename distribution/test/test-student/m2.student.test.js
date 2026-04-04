/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/
const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');
const http = require('node:http');
const local = distribution.local;
const id = distribution.util.id;

// //status.get
// //testing things in different sequence.: sid . ip.
// test('(1 pts) student test', (done) => {
//   const id = distribution.util.id;
//   const config = distribution.node.config;
//   distribution.local.status.get('sid', (e,v) => {
//   try {
//     expect(e).toBeFalsy();
//     expect(v).toEqual(id.getSID(config));
//   } catch (error) {
//     console.log(error);
//   }});

//   distribution.local.status.get('ip', (e, v) => {
//     try {
//       expect(e).toBeFalsy();
//       expect(v).toEqual(config.ip);
//       done();
//     } catch (error) {
//       done(error);
//     }
//   });
// });

// //routes.get
// test('(1 pts) student test', (done) => {
//   const routes = distribution.local.routes;
//   routes.get('routes', (e, v) => {
//       try {
//         expect(e).toBeFalsy();
//         expect(v).toEqual(routes);
//       } catch (error) {
//         console.log(error);
//       }
//     });
//     distribution.local.routes.get('print', (e, v) => {
//     try {
//       expect(e).toBeDefined();
//       expect(e).toBeInstanceOf(Error);
//       expect(v).toBeFalsy();
//       done();
//     } catch (error) {
//       done(error);
//     }
//   });
// });

// //routes.put
// test('(1 pts) student test', (done) => {
//   const pingService = {};
//   const routes = distribution.local.routes;
//   pingService.ping = () => {
//     return 'ping!';
//   };
//   const pongService  = {}
//   routes.put(pongService, 'pong', (e,v) => {})
//   routes.put(pingService, 'ping', (e,v) => {
//   routes.get('ping', (e, v) => {
//       try {
//         expect(e).toBeFalsy();
//         expect(v.ping()).toEqual('ping!');
//         done();
//       } catch (error) {
//         done(error);
//       }
//     });
//   });
// });


// //routes.rem
// test('(1 pts) student test', (done) => {
//   const routes = distribution.local.routes
//   const tempService = {};
//   tempService.hello = () => 'world';
//   routes.put(tempService, 'temp', (e, v) => {
//     routes.rem('temp', (e, v) => {
//       routes.get('temp', (e, v) => {
//         try {
//           expect(e).toBeInstanceOf(Error);
//           expect(v).toBeFalsy();
//           done();
//         } catch (error) {
//           done(error);
//         }
//       });
//     });
//   });
// });

// beforeAll((done) => {
//   distribution.node.start((e) => {
//     if (e) {
//       done(e);
//       return;
//     }
//     done();
//   });
// });

// afterAll((done) => {
//   if (globalThis.distribution.node.server) {
//     globalThis.distribution.node.server.close();
//   }
//   done();
// });

// //comm.send
// test('(1 pts) student test', (done) => {
//   const node = distribution.node.config;
//   const id = distribution.util.id;
//   const remote = {node: node, service: 'status', method: 'get'};
//   const message = [
//     'sid',
//   ];

//   distribution.local.comm.send(message, remote, (e, v) => {
//     try {
//       expect(e).toBeFalsy();
//       expect(v).toEqual(id.getSID(node));
//       done();
//     } catch (error) {
//       done(error);
//     }
//   });
// });

// comm performance test
test('(1 pts) student test - comm performance', (done) => {
  const node = distribution.node.config;
  const remote = {node: node, service: 'status', method: 'get'};
  const message = ['sid'];
  const numRequests = 1000;
  let completed = 0;
  const startTime = Date.now();
  for (let i = 0; i < numRequests; i++) {
    local.comm.send(message, remote, (e, v) => {
      if (e) {
        errors++;
      } else {
          expect(v).toEqual(id.getSID(node));
      }
      completed++;
      if (completed === numRequests) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        const requestsPerSecond = (numRequests / duration) * 1000;
        console.log(`  Total requests: ${numRequests}`);
        console.log(`  Duration: ${duration}ms`);
        try {
          expect(completed).toBe(numRequests);
          done();
        } catch (error) {
          done(error);
        }
      }
    });
  }
}, 30000);

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
