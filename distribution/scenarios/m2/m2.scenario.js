require('../../distribution.js')();

const distribution = globalThis.distribution;

test('(2 pts) (scenario) simple callback practice', () => {
  /* Collect the result of 3 callback services in list  */
  const results = [];

  //this function calls add on a and b, and then uses the callback on the result
  function add(a, b, callback) {
    const result = a + b;
    callback(result);
  }
  
  function storeResults(result) {
    results.push(result);
  }

  add(1, 2, storeResults)
  add(2, 3, storeResults)
  add(3, 4, storeResults)
  expect(results).toEqual([3, 5, 7]);
});

test('(2 pts) (scenario) collect errors and successful results', (done) => {
  /*
          Call each delivery service in a loop, and collect the sucessful results and
          failures in an array.
      */

  // Sample service
  const appleDeliveryService = (callback) => {
    const result = "good apples"
    return callback(null, result)
  };

  const pineappleDeliveryService = (callback) => {
    const result = Error("bad pineapples")
    return callback(result, null)
  };

  const bananaDeliveryService = (callback) => {
    const result = "good bananas"
    return callback(null, result)
  };

  const peachDeliveryService = (callback) => {
    const result = "good peaches"
    return callback(null, result)
  };

  const mangoDeliveryService = (callback) => {
    const result = Error("bad mangoes")
    return callback(result, null)
  };

  const services = [
    appleDeliveryService, pineappleDeliveryService, bananaDeliveryService,
    peachDeliveryService, mangoDeliveryService,
  ];

  //try to assert the array contains
  // Vs of string values: apples, bananas, peaches
  // Es of error messages: pineapples, mangoes
  const doneAndAssert = (es, vs) => {
    try {
      expect(vs.length).toEqual(3);
      expect(vs).toContain('good apples');
      expect(vs).toContain('good bananas');
      expect(vs).toContain('good peaches');
      for (const e of es) {
        expect(e instanceof Error).toEqual(true);
      }
      const messages = es.map((e) => e.message);
      expect(messages.length).toEqual(2);
      expect(messages).toContain('bad pineapples');
      expect(messages).toContain('bad mangoes');
      done();
    } catch (e) {
      done(e);
    }
  };

  const vs = [];
  const es = [];
  //for each service, we give it the function which pushes either (e,v) to es or vs.
  let expecting = services.length;
  for (const service of services) {
    service((e, v) => {
      if (e) {
        es.push(e);
      } else {
        vs.push(v);
      }
      expecting -= 1;
      if (expecting === 0) {
        doneAndAssert(es, vs);
      }
    });
  }
});

test('(5 pts) (scenario) use rpc', (done) => {
  //creating a stateful function at n2, with RPC stub on n1.
  let n = 0;
  const addOne = () => {
    return ++n;
  };
  const node = {ip: '127.0.0.1', port: 9009};
  let addOneRPC = distribution.util.wire.createRPC(distribution.util.wire.toAsync(addOne))

  const rpcService = {
    addOne: addOneRPC,
  };
  
  distribution.node.start(() => {
    function cleanup(callback) {
      if (globalThis.distribution.node.server) {
        globalThis.distribution.node.server.close();
      }
      distribution.local.comm.send([],
          {node: node, service: 'status', method: 'stop'},
          callback);
    }
    // Spawn the remote node.
    distribution.local.status.spawn(node, (e, v) => {
      // Install the addOne service on the remote node with the name 'addOneService'.
      distribution.local.comm.send([rpcService, 'addOneService'],
          {node: node, service: 'routes', method: 'put'}, (e, v) => {
            // Call the addOne service on the remote node. This should actually call the addOne function on this code using RPC.
            distribution.local.comm.send([],
                {node: node, service: 'addOneService', method: 'addOne'}, (e, v) => {
                  // Call the addOne service on the remote node again.
                  distribution.local.comm.send([],
                      {node: node, service: 'addOneService', method: 'addOne'}, (e, v) => {
                        // Call the addOne service on the remote node again. Since we called the addOne function three times, the result should be 3.
                        distribution.local.comm.send([],
                            {node: node, service: 'addOneService', method: 'addOne'}, (e, v) => {
                              try {
                                expect(e).toBeFalsy();
                                expect(v).toEqual(3);
                                /* The local variable n should also be 3. Remember: The addOne RPC is actually invoking the addOne function locally. */
                                expect(n).toEqual(3);
                                cleanup(done);
                              } catch (error) {
                                cleanup(() => {
                                  done(error);
                                });
                              }
                            });
                      });
                });
          });
    });
  });
});
