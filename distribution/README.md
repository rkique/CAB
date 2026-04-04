# distribution

This is the distribution library. 

## Environment Setup

We recommend using the prepared [container image](https://github.com/brown-cs1380/container).

## Installation

After you have setup your environment, you can start using the distribution library.
When loaded, distribution introduces functionality supporting the distributed execution of programs. To download it:

```sh
$ npm i '@brown-ds/distribution'
```

This command downloads and installs the distribution library.

## Testing

There are several categories of tests:
  *	Regular Tests (`*.test.js`)
  *	Scenario Tests (`*.scenario.js`)
  *	Extra Credit Tests (`*.extra.test.js`)
  * Student Tests (`*.student.test.js`) - inside `test/test-student`

### Running Tests

By default, all regular tests are run. Use the options below to run different sets of tests:

1. Run all regular tests (default): `$ npm test` or `$ npm test -- -t`
2. Run scenario tests: `$ npm test -- -c` 
3. Run extra credit tests: `$ npm test -- -ec`
4. Run the `non-distribution` tests: `$ npm test -- -nd`
5. Combine options: `$ npm test -- -c -ec -nd -t`

## Usage

To try out the distribution library inside an interactive Node.js session, run:

```sh
$ node
```

Then, load the distribution library:

```js
> let distribution = require("@brown-ds/distribution")();
> distribution.node.start(console.log);
```

Now you have access to the full distribution library. You can start off by serializing some values. 

```js
> s = distribution.util.serialize(1); // '{"type":"number","value":"1"}'
> n = distribution.util.deserialize(s); // 1
```

You can inspect information about the current node (for example its `sid`) by running:

```js
> distribution.local.status.get('sid', console.log); // null 8cf1b (null here is the error value; meaning there is no error)
```

You can also store and retrieve values from the local memory:

```js
> distribution.local.mem.put({name: 'nikos'}, 'key', console.log); // null {name: 'nikos'} (again, null is the error value) 
> distribution.local.mem.get('key', console.log); // null {name: 'nikos'}

> distribution.local.mem.get('wrong-key', console.log); // Error('Key not found') undefined
```

You can also spawn a new node:

```js
> node = { ip: '127.0.0.1', port: 8080 };
> distribution.local.status.spawn(node, console.log);
```

Using the `distribution.all` set of services will allow you to act 
on the full set of nodes created as if they were a single one.

```js
> distribution.all.status.get('sid', console.log); // {} { '8cf1b': '8cf1b', '8cf1c': '8cf1c' } (now, errors are per-node and form an object)
```

You can also send messages to other nodes:

```js
> distribution.local.comm.send(['sid'], {node: node, service: 'status', method: 'get'}, console.log); // null 8cf1c
```

Most methods in the distribution library are asynchronous and take a callback as their last argument.
This callback is invoked when the method completes, with the first argument being an error (if any) and the second argument being the result.
The following runs the sequence of commands described above inside a script (note the nested callbacks):

```js
let distribution = require("@brown-ds/distribution")();
// Now we're only doing a few of the things we did above
const out = (cb) => {
  distribution.local.status.stop(cb); // Shut down the local node
};
distribution.node.start(() => {
  // This will run only after the node has started
  const node = {ip: '127.0.0.1', port: 8765};
  distribution.local.status.spawn(node, (e, v) => {
    if (e) {
      return out(console.log);
    }
    // This will run only after the new node has been spawned
    distribution.all.status.get('sid', (e, v) => {
      // This will run only after we communicated with all nodes and got their sids
      console.log(v); // { '8cf1b': '8cf1b', '8cf1c': '8cf1c' }
      // Shut down the remote node
      distribution.local.comm.send([], {service: 'status', method: 'stop', node: node}, () => {
        // Finally, stop the local node
        out(console.log); // null, {ip: '127.0.0.1', port: 1380}
      });
    });
  });
});
```

# Results and Reflections

# M0: Setup & Centralized Computing
* name: `Eric Xia`

* email: `eric_xia@brown.edu`

* cslogin: `exia3`

## Summary

> Summarize your implementation, including the most challenging aspects; remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete M0 (`hours`), the total number of JavaScript lines you added, including tests (`jsloc`), the total number of shell lines you added, including for deployment and testing (`sloc`).

My implementation consists of `7` components addressing T1--8. The most challenging aspect was implementing the additional tests. During the implementation, a slew of minor issues made many outputs to the console and error stream uninformative. The ultimate issues included distinguishing tabs and spaces within whitespace, relative and absolute file paths, and escaping quotes within shell commands. Within query.js, I also encountered a similar issue with interpreting the args parameter correctly. The solution employs a regex to escape single quotes, and subsequently wraps arguments within their own set of quotes.

## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation.

To characterize correctness, I developed `9` tests which cover the following cases: 
- s_getURLs.sh: extract links from alternative data source (personal website)
- s_getText.sh: extract text from alternative data source (project description page)
- s_test_process.sh: extract links from alternative content from html (personal website)
- s_test_stem.sh: stems a list of common English words (rule-based, not morphologically sound)
- s_test_combine.sh: tests bigram and trigram generation from a fixed set of words
- s_test_invert.sh: tests inversion on a list generated from project page
- s_test_merge.sh: tests merge combination of indices
- s_test_end_to_end.sh: tests merge combination of local and global index

*Performance*: The throughput of various subsystems is described in the `"throughput"` portion of package.json. To characterize the throughput, a timed version of engine.sh was run on two diverse benchmarks: sandbox-2, a small collection of books with ~5 urls, and sandbox-4, a large web of quotes with ~200 urls. The average crawl, index, and query throughput was estimated by first dividing the total time for the crawl and index operations by the number of urls visited for each sandbox, and then averaging across both sandboxes.

```
Sandbox 2 - Dev (M1)
crawl time: 4
index time: 34
crawl urls: 4
query time: 3s, 5 queries

Sandbox 4 - Dev (M1)
crawl time: 85
index time: 72
crawl urls: 228
query time: 3s, 5 queries

Sandbox 2 - AWS t3.micro
crawl time: 9
index time: 11
crawl urls: 4
query time: 2 seconds, 5 queries

Sandbox 4 - AWS t3.micro
crawl time: 257
index time: 164
crawl urls: 228
query time: 2 seconds, 5 queries
```

The characteristics of my development machines are summarized in the `"dev"` and `"aws"` of package.json. For the development, a M2 Macbook Air (16 GB RAM) was used. For deployment on the cloud, a t3.micro instance was used.

## Wild Guess

> How many lines of code do you think it will take to build the fully distributed, scalable version of your search engine? Add that number to the `"dloc"` portion of package.json, and justify your answer below.

I am guessing it will take 2000 lines of code to write a distributed version of the search engine, and make the current implementation scalable. I anticipate writing a small amount of code to optimize parallel operations among the current components, a larger amount of code around the current components to allow them to be called in unison, and a similarly large amount of code to communicate status to one another.

# M1: Serialization / Deserialization


## Summary

My implementation consists of a serialization and a deserialization funcion, and totals `150` lines of code. The basic implementation strategy is to break each type into a separate serialization and deserialization strategy, which often uses an internal string representation method.

One major challenge faced was handling function object deserialization. The `toString` method simply describes the surface syntax, and requires careful handling to extract the function arguments and body. The function constructor was helpful for instantiating the reassembled function, yet understanding the correct pattern on the input was complicated. The intended implementation may have utilized a different serialization pattern. 

Another major challenge involved serializing array objects. The reference implementation utilized an ordered dict as the value of the serialized object. In order to reestablish individual elements of the array, `Array.from` was employed. In combination with a recursive call on `serializedDict`, this allowed the deserialization of individual elements in order.

For subtypes of Object such as Error, I utilized the builtin method `getOwnPropertyNames` to stringify each property. The subsequent deserialization utilized `Object.assign` to reestablish the method fields.

The fallback serialization and deserialization assumes the input is an object.

## Correctness & Performance Characterization

*Correctness*: I wrote `5` tests, which took between 0.1 to 10 milliseconds to execute within my development environment, and between 2-10 times as long on the EC2 instance. This included tests for simple strings, functions, nested objects, and the date / error subclasses. Different function types were tested to ensure the function serialization worked as intended.

*Performance*: The latency of various subsystems is described in the `"latency"` portion of package.json. The characteristics of my development machines are summarized in the `"dev"` portion of package.json.

# M2: Actors and Remote Procedure Calls (RPC)

## Summary

The implementation of the distribution.js module was done in three parts. On average, the lines of code written matched the expected lines on the milestone document, with the exception of `routes` which took 20-30 lines more. The most difficult tests to debug had to do with the `node.js` http request and `comm.send`, as it was necessary to track data in multiple places.

The first part involved writing control logic for `status.get`. These retrieved properties for the current node from `distribution.node.config`, and were for the most part straightforward. The second part involved implementing a map for the routes on a node to service objects. The put and rem methods were made much simpler by settling on a single data structure to handle the routes within `get`.  In the third and final part, I implemented `comm.send`, which sent message contents within an PUT http request. 


My implementation comprises 3 software components, totaling 150 lines of code. 

Initializing counts within `node.js` was somewhat confusing, as I misunderstood how module imports work.

Within the body of `routes.get`, there were several edge cases involving missing defaults. In addition, implementing the `routes` call within `routes.get` was confusing due to the circular dependency.

I struggled with understanding where the callback function for send should be called. Ultimately, the logical place was to have it called with the deserialized response, thus reflecting the remote node function execution correctly.


## Correctness & Performance Characterization


To characterize correctness of the module, both provided and student tests were run. I wrote 5 tests, one for each of `status.get`, `routes.get`, `routes.put`, `routes.rem`, and `comm.send`. Each test examined unique functionality of the associated component. Altogether, the tests take 1 second to execute.

*Performance*: I characterized the performance of the comm functionality by sending 1000 service requests in a tight loop, averaged over five separate runs. The test was performed for both the development machine and the remote machine. Average throughput is recorded in `package.json`.


## Key Feature

> How would you explain the implementation of `createRPC` to someone who has no background in computer science — i.e., with the minimum jargon possible?

createRPC gives one computer the ability to call functions on other computers, working with that computer's data and setup. This is useful when you want to compute something really fast, or when you want to access private resources. 

To make a sort of "linked copy" of a remote function on your own computer, you would want to first call createRPC on that function from the remote computer. Then you send the resulting function over the network to your computer. 

What createRPC does to the function is add steps in between the processing of arguments and the return value. It has to convert the arguments to text, so that they can be sent along with the function to the remote computer, call the function on the remote node. 

Then, it has to convert the result to text which can be sent back to your own computer, and make it seem like the function on your computer produced it.

# M3: Node Groups & Gossip Protocols

## Summary

The implementation relies on two core components: the groups abstraction, and `all.comm` to enable distributed communication between nodes. To enable the groups abstraction for individual views, `local.groups` was written to add, remove, and update node maps for individual views. This way, each method under `groups` enumerates id-configuration maps, which allow specification of addressees within the `comm` interface.

Supporting code in `local.comm`, `local.routes`, and `local/node.js` was necessary to allow sending messages by groups. 

Next, the `all.comm` method was implemented, which sequentially communicated with all nodes within a particular node's group view. Once the total number of responses were received, errors and responses were returned as two objects. This provided a basis for implementing the other distributed methods, `status.js`, `groups.js`, `routes.js`, all of which rely on fanning out to individual nodes within a group.  

My implementation comprises `8` new software components, totaling `450` added lines of code over the previous implementation. Around 150 lines of code were added to the testing file. The tests involved setting up a node spawning and stopping procedure, and calling various distributed services on active nodes.

I encountered several issues with the imported distribution library and the test infrastructure. In particular, the jest framework would often hang even with fairly minimal test setups. Eventually, I resolved the issues by carefully choosing imports from distributionLib. These did not override any of the intended components from the distributed services or groups, but rather allowed the server start and spawn to function as expected.

Another challenge faced was understanding how to setup distributed services within the local groups call. Even though I understood conceptually the service-as-closure idea, I didn't connect it to the groupServices for individual properties of distribution. After going to hours, I was pointed to the setup function in all.js.

Once I understood the groups abstraction, implementing syntax for using the communication service was much easier, and the rest of the implementation went smoothly.

## Correctness & Performxzance Characterization

> Describe how you characterized the correctness and performance of your implementation


*Correctness* -- I wrote 5 tests, including som with multiple intermediate setup steps. These tests covered varied areas from my own implementation. This included local groups, all.comm.send, status.get, groups.put, and routes.get. I also created many smaller tests throughout to understand constructors and intended implementation. These small tests included use of the `log` uility, in addition to `util.inspectObject` for differentiating student and reference implementations. 

*Performance* -- spawn times (all students) and gossip (lab/ec-only).


## Key Feature

> What is the point of having a gossip protocol? Why doesn't a node just send the message to _all  in its group?

Implementing gossip allows messages to propagate quickly and with a lighter load for each node involved. This is particularly important in developing large systems in which nodes be under geographical constraints, or where partitions might exist between nodes. With gossip protocols, as long as each node implements the correct procedure, nodes will converge to the same eventual value for any particular message.

# M4: Distributed Storage


## Summary

My implementation implements temporary and permanent key-value store functionality under the `mem` and `store` services. It does so by instantiating an in-memory dictionary under `mem` and resolving a unique file path identifier within `store`. For both methods, a normalization function is used to standardize inputs and handle null values. The implementation then uses the respective read and write functionality for dictionaries and the filesystem in order to save in memory or persist data to storage. For each distributed method, a call to `groups.get` is first invoked to retrieve all nodes belonging to the respective group identifier. The key identifier is then hashed via `context.hash` to identify the appropriate node. It is assumed that values stored fit within storage and that only a single call is necessary for each item. 

Key challenges included handling edge cases for the configuration and ensuring that the remote key store is accessible via direct RPC of the stored method. Other issues faced were in identifying the appropriate callbacks necessary to perform a remote call to the storage method, and to ensure that the correct node was identified by the node id alone.

## Correctness & Performance Characterization

> Correctness was characterized via student tests, which examined the local mem and store put, get, and del methods in addition to the distributed versions of the same. Tests were likewise implemented for consistent hash and group retrieval functionality. The total amount of time taken by the tests is 100ms.

> Performance was characterized by running tests/m4.timer.latency on both development and cloud machines. The benchmark executed 1000 sequential insert and query operations against both the persistent store and in-memory backends, measuring total execution time to compute average latency (ms per operation) and throughput (operations per second). Tests were performed in three configurations: local single-node execution, distributed execution in the development environment, and distributed deployment across AWS EC2 instances, enabling comparison of backend type (store vs. memory) and deployment environment (local vs. cloud).


## Key Feature

> Why is the `reconf` method designed to first identify all the keys to be relocated and then relocate individual objects instead of fetching all the objects immediately and then pushing them to their corresponding locations?

Fetching all objects at once would require unified storage for all key-value pairs, which is exactly what the distributed system is built to avoid. 

In addition to the memory constraints, the scope of the necessary processing could be much less than all nodes in the system. For instance, with consistent or rendevous hashing, the shards affected by the addition or removal of a node is a small fraction of the total. After moving these objects, the system retains the consistency guarantee that storage is well-balanced between individual nodes.

# M5: Distributed Execution Engine

## Summary

My implementation includes 4 new components of software, separated into distributed and local components. In the local component, map, shuffle, and reduce components were implemented and made available to all nodes running `distribution.js`. In the distributed component, an exec component was designed to handle coordinating state between other aspects of the computation. This required keeping track of the nodes which had finished computations, metadata for tracking keys and their insertion by state, and metadata for allowing both array and object types to be handled by the reducer. As suggested by the handout, a notify service was used to communicate status between the coordinator and worker nodes, which allowed the coordinator to schedule fanout messaging for the map, shuffle, and reduce steps respectively. In addition, the coordinator node implementation deregisters the service upon completion. 

The exec method defines the coordinatorService and registers it on the local node. It then begins the initial fanout to send the map and reduce methods to other nodes, and starts the map computation. Subsequent calls to worker nodes and notify requests are handled by the coordinatorService.

## Correctness & Performance Characterization

To characterize the correctness, I wrote four scenarios. These covered word count, TF-IDF scoring, string matching, and reverse web link graph problems, representing a varied sample of the kinds of MapReduce problems which exist. In addition to these tests, a exec-noops-min and exec-min student tests were implemented, which utilized the notifier alone and ensured that the orchestration process was valid.


My distributed MapReduce workflow (characterized with the `all.mr:dlib` scenario) can sustain `21.88` jobs/second, with an average latency of `45.7` ms per job (`0.0457` seconds/job).


## Key Feature

> Which extra features did you implement and how?