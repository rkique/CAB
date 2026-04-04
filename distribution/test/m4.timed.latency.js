//Script to evaluate series of object insertion and retrieval tests

const fs = require('fs');
const path = require('path');
const distribution = require('../distribution.js')();
const status = require('../distribution/all/status');
const id = require('../distribution/util/id.js');

const g1 = {};
const g2 = {};

fs.rmSync(path.join(__dirname, '../store'), {recursive: true, force: true});
fs.mkdirSync(path.join(__dirname, '../store'));

//EC2 instances
const n1 = {ip: '172.31.46.101', port: 9001};
const n2 = {ip: '172.31.36.229', port: 9002};
const n3 = {ip: '172.31.39.133', port: 9003};

//local dev
// const n1 = {ip: '127.0.0.1', port: 9001};
// const n2 = {ip: '127.0.0.1', port: 9002};
// const n3 = {ip: '127.0.0.1', port: 9003};
// const n4 = {ip: '127.0.0.1', port: 9004};
// const n5 = {ip: '127.0.0.1', port: 9005};
// const n6 = {ip: '127.0.0.1', port: 9006};


const remote = {status: 'status', method: 'stop'};
remote.node = n1;

//add functionality for: 
const testInsertionAndQuerying = (method) => {
    const kvPairs = {};
    const numPairs = 1000;
    
    // Generate 1000 key-value pairs
    for (let i = 0; i < numPairs; i++) {
        kvPairs[`key_${i}`] = `value_${i}`;
    }
    
    // Insert objects to distributed kv store
    const insertStartTime = performance.now();
    let insertedCount = 0;
    
    Object.entries(kvPairs).forEach(([key, value]) => {
        method.put(key, value, (e, v) => {
            insertedCount++;
        });
    });
    
    // Query all objects (by key) with timing
    setTimeout(() => {
        const insertEndTime = performance.now();
        const insertLatency = insertEndTime - insertStartTime;
        const insertThroughput = (numPairs / insertLatency) * 1000;
        
        console.log(` Insertion - Latency: ${(insertLatency / 1000).toFixed(2)}ms, Throughput: ${insertThroughput.toFixed(2)} ops/sec`);
        
        const queryStartTime = performance.now();
        let queriedCount = 0;
        
        Object.keys(kvPairs).forEach((key) => {
            method.get(key, (e, v) => {
                queriedCount++;
            });
        });
        
        setTimeout(() => {
            const queryEndTime = performance.now();
            const queryLatency = (queryEndTime - queryStartTime) 
            const queryThroughput = (numPairs / queryLatency) * 1000;
            
            console.log(` Querying - Latency: ${(queryLatency / 1000).toFixed(2)}ms, Throughput: ${queryThroughput.toFixed(2)} ops/sec`);
        }, 500);
    }, 500);
};


// AWS 
const startCluster = () => {
  const g1 = {};

  g1[id.getSID(n1)] = n1;
  g1[id.getSID(n2)] = n2;
  g1[id.getSID(n3)] = n3;

  const g1Config = { gid: 'g1' };

  distribution.local.groups.put(g1Config, g1, (e, v) => {
    if (e) {
      console.error("Group creation failed:", e);
      return;
    }
    console.log("Distributed group created.");
    console.log('Store')
    testInsertionAndQuerying(distribution.local.store);
    console.log('Mem')
    testInsertionAndQuerying(distribution.local.mem);
  });
};
startCluster();

//local development
const stopNodes = () => {
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
                console.log('All nodes stopped, closing server');
              if (globalThis.distribution.node.server) {
                globalThis.distribution.node.server.close();
              }
            });
          });
        });
      });
    });
  });
}

// const startNodes = () => {
//     g1[id.getSID(n1)] = n1;
//     g1[id.getSID(n2)] = n2;
//     g1[id.getSID(n3)] = n3;
//     g1[id.getSID(n4)] = n4;
//     g1[id.getSID(n5)] = n5;

//     g2[id.getSID(n1)] = n1;
//     g2[id.getSID(n2)] = n2;
//     g2[id.getSID(n3)] = n3;
//     g2[id.getSID(n4)] = n4;
//     g2[id.getSID(n5)] = n5;
//     g2[id.getSID(n6)] = n6;

//     //start node listeners
//     distribution.node.start( (e) => {
//         if (e) { console.log(e); return; }
//         const groupInstantiation = () => {
//             const g1Config = {gid: 'g1'};
//             distribution.local.groups.put(g1Config, g1, (e, v) => {
//                 console.log('g1 group created');
//             });
//         };
//         distribution.local.status.spawn(n1, (e,v) => {
//             if (e) { console.log(e); return; }
//             distribution.local.status.spawn(n2, (e,v) => {
//                 if (e) { console.log(e); return; }
//                 distribution.local.status.spawn(n3, (e,v) => {
//                     if (e) { console.log(e); return; }
//                     distribution.local.status.spawn(n4, (e,v) => {
//                         if (e) { console.log(e); return; }
//                         distribution.local.status.spawn(n5, (e,v) => {
//                             if (e) { console.log(e); return; }
//                             distribution.local.status.spawn(n6, (e,v) => {
//                                 if (e) { console.log(e); return; }
//                                 groupInstantiation();
//                                     console.log('Store')
//                                     testInsertionAndQuerying(distribution.local.store);
//                                     console.log('Mem')
//                                     testInsertionAndQuerying(distribution.local.mem);
//                                 setTimeout(stopNodes, 2000);
//                             });
//                         });
//                     });
//                 });
//             });
//         });
//     });

// }

// //assign nodes and then start.
// distribution.local.comm.send([], remote, (e, v) => {
//   remote.node = n2;
//   distribution.local.comm.send([], remote, (e, v) => {
//     remote.node = n3;
//     distribution.local.comm.send([], remote, (e, v) => {
//       remote.node = n4;
//       distribution.local.comm.send([], remote, (e, v) => {
//         remote.node = n5;
//         distribution.local.comm.send([], remote, (e, v) => {
//           remote.node = n6;
//           distribution.local.comm.send([], remote, (e, v) => { 
//             startNodes();
//           });
//         });
//       });
//     });
//   });
// });