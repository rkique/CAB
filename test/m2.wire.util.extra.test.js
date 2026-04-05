require('../distribution.js')();
require('./helpers/sync-guard');
const distribution = globalThis.distribution;

test('(25 pts) rpc', (done) => {
  let localVar = 0;

  const addOne = () => {
    return ++localVar;
  };

  const addOneRPC = distribution.util.wire.createRPC(
      distribution.util.wire.toAsync(addOne));

  const addOneService = {
    addOneRemote: addOneRPC,
  };

  distribution.local.routes.put(addOneService, 'rpcService', (e, v) => {
    // Call the RPC stub locally
    addOneRPC((e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toEqual(1);
        expect(localVar).toEqual(1);
        // Simulate a remote call
        distribution.local.comm.send([],
            {node: distribution.node.config, service: 'rpcService', method: 'addOneRemote'}, (e, v) => {
              try {
                expect(e).toBeFalsy();
                expect(v).toEqual(2);
                expect(localVar).toEqual(2);
                done();
              } catch (error) {
                done(error);
                return;
              }
            });
      } catch (error) {
        done(error);
        return;
      }
    });
  });
});

test('(25 pts) rpc w/ arguments', (done) => {
  let localVar = 5;

  function addSth(n) {
    return localVar += n;
  }

  const addSthRPC = distribution.util.wire.createRPC(
      distribution.util.wire.toAsync(addSth));

  const addSthService = {
    addSthRemote: addSthRPC,
  };

  distribution.local.routes.put(addSthService, 'rpcService', (e, v) => {
    addSthRPC(42, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v).toEqual(47);
        expect(localVar).toEqual(47);
        distribution.local.comm.send([3],
            {node: distribution.node.config, service: 'rpcService', method: 'addSthRemote'}, (e, v) => {
              try {
                expect(e).toBeFalsy();
                expect(v).toEqual(50);
                expect(localVar).toEqual(50);
                done();
              } catch (error) {
                done(error);
                return;
              }
            });
      } catch (error) {
        done(error);
        return;
      }
    });
  });
});

/*
    Following is the setup for the tests.
*/

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
