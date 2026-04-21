
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

## Local Course Search Server

Run the local search UI from the CAB root directory:

```sh
npm install
node frontend/search-server.js --local
```

Then open:

```text
http://localhost:3000
```

Notes:
- The local server expects an OpenAI key at `data/openai.key`.
- If port 3000 is already in use, stop the existing process and rerun the command above.

## Search UI Images

![Bruno Course Search UI](frontend/images/bruno.png)

![Brown University Image](frontend/images/brown_u.jpg)

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

> Add your contact information below and in `package.json`.

* name: `<Isaac Calderon>`

* email: `<isaac_calderon@brown.edu>`

* cslogin: `<iacalder>`


## Summary

> Summarize your implementation, including the most challenging aspects; remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete M0 (`hours`), the total number of JavaScript lines you added, including tests (`jsloc`), the total number of shell lines you added, including for deployment and testing (`sloc`).


My implementation consists of 6 components including the main components neeeded for the search engine itself such as the getText.js and getURL.js and stem.sh as well as merge.js and process.sh components and I also wrote an extra component called benchmark.js which is used to document the throughput of the crawler, indexer, and query on a corpora that you input through command line arguments. 


## Correctness & Performance Characterization


> Describe how you characterized the correctness and performance of your implementation.


To characterize correctness, I developed multiple test cases and added extra documents in the d/ subdirectory aimed at testing multiple test cases. Some of these test cases included duplicate URLs, nested HTMLs, mixed URLs, proper bigram handling. In order to characterize performance I created the benchmark.js file as mentioned above which takes in a inputted corpora from the command line argument. It tracks the number of pages crawled per second as well as the number of pages indexed per second and finally the amount of queries per second. It runs all three of the subsystems on the same corpora.


*Performance*: The throughput of various subsystems is described in the `"throughput"` portion of package.json. The characteristics of my development machines are summarized in the `"dev"` portion of package.json.


## Wild Guess

> How many lines of code do you think it will take to build the fully distributed, scalable version of your search engine? Add that number to the `"dloc"` portion of package.json, and justify your answer below.


I believe it will take around 3,000 - 5,000 lines of code in total in order to build the fully distributed scalable vesion of the search engine. I believe this is the case because there are around 8 milestones with a few of them involving multiple collaborators which indicates to me several hundred line of code for each of the main milestones. Also I believe that since we haven't implemented any of the distributed components yet I could see that involving a lot of code. 


# M1: Serialization / Deserialization


## Summary

My implementation consists of being able to serialize and deserialize different types of data structures and data types which is extremely important in the context of distributed systems. Nodes should be able to reliably serialize and deserialize different data to one another in order to be able to increase the speed of workflows and other tasks.

My implementation comprises three main software components besides the additional tests and scenarios of course.
It totals around 414 lines of code. These three componenets are the serialize, deserialize, and test file. The serialize and deserialize functions are within the same file. The serialize and deserialize functions both take advantage of the use of helper functions in order to handle the many if statements and recursive data structures to keep the main functions clean and more direct.
Key challenges included T4 which was added support for complex, recursive structures as well as functions.  


## Correctness & Performance Characterization


> Describe how you characterized the correctness and performance of your implementation

In order to characterize the correctness of my implementation, I wrote 5 tests within the m1.student.test.js file. These tests take around 0.215 seconds to run. The tests include testing the functionality of serializing and deserializing arrays with multiple different data types within the indices such as ints, strings, null values and boolean values such as true and false. Another test tests the serialize and deserialize functionality for simple functions such as one that takes in two parameters and adds them together and adds 1 to the total. Another tests using more complex objetcs with multiple data fields including some nested data structures. The last two test the date object and error objects and make sure they serialize and deserialize properly. In order to characterize the performance of my implementation I wrote an addtional file called m1.performance.js under the m1 folder where I wrote code that calculates the latency of serializing and deserialzing base types, callable functions, and structured data objects. I calculated the average time it takes to serialize and deserialize these different types of objects over 1000 repetitions and multiple samples. I then ran this script within two different environments.


# M2: Actors and Remote Procedure Calls (RPC)


## Summary


My implementation comprises 4 software components totaling 606 lines of code. Key challenges included formulating a clear understanding of the architecture and structure of the interactions between the multiple components such as the comm, status, and route components. Implementing the node.start function was also pretty challenging as there were many things to keep in mind such as correctly serializing arguments from the caller to the remote node and then deserializing the results from the remote node's function execution. Furthermore with all the overhead involved in this function error checking became a little more tedious and involved as there are many different potential types of errors.


## Correctness & Performance Characterization


I wrote 5 tests. These tests take around 0.308 seconds to run.
They test the status component's methods such as get and the various different types of objects you can request with gid such as a node's nid, sid, and gid. I also tested being able to instantiate a service and add it to the routes map of names to services using put and then using get to make sure that it returns the correct data fields associated with that service. I also test starting a node and then using local.comm to send a status service with method get and then ensuring that the value returned from this interaction is the proper one.


I characterized the performance of by creating another script within the scenarios/m2 folder which sends 1000 service requests in tight loop. It doess this by first creating a service called echoService which just pings the message "pong" and then starts the node. It then registers the service on the node using put. It thenn starts an async function which runs 1000 times for each of the server requests. I then collected the metrics such as throughput and latency. Average throughput and latency is recorded in `package.json`.

## Key Feature

> How would you explain the implementation of `createRPC` to someone who has no background in computer science — i.e., with the minimum jargon possible?

Taking CS1380



# M3: Node Groups & Gossip Protocols


## Summary

My implementation comprises 4 new software components which includes the all/comm.js, all/groups.js, all/routes.js, all/status.js, and local.groups files. Some other aspects of my implementation included editing parts of code of the local node from the previous milestone including updates on local.routes, local.comm, and local/node.js. For example I had to make edits so that there would now be distributed support for each of these components. For example I needed to enable local nodes to access distributed services available on other nodes. Some challenges include dealing with gid semantics correctly and group instantiation with services being initialized correctly. Debugging was also another issue as it is harder to debug when there are several cascading issues which can make it more difficult to find the root issue.

## Correctness & Performance Characterization

*Performance* -- spawn times (all students) and gossip (lab/ec-only).

I characterized the correctness of my implementation by writing 5 additional student tests aimed at making sure that distributed services are correctly executed on the various nodes. For example, one test checls that results from distributed calls are correctly aggregated since distributed calls equate to several local calls on each node belonging to a specific node group.

I characterized the performance of my implementation by writing a script that measures the average time it takes to spawn a node. 


## Key Feature


The gossip protocol ensures lower overhead as it is more expensive for a node to send messages to all nodes in its group. It also scales better with group size and spreads widely via repeated peer-to-peer forwarding which guarantees eventual converence with high probability.



# M4: Distributed Storage


## Summary

My implementation consists of the components local/mem.js, local/store.js, all/mem.js, and all/store.js. The mem compnents serve as implementations of in memory hashmaps. Similary the store components for both the local and distributed versions have similar APIs but instead persist values to disk using fs. This then writes into the project's root store/directory and uses node specific subdirectories using the node's NID. Interestingly the distributed versions have the added functionality of computing a KID from the primary key and then using a hashing function over the group's NIDS to choose a node that will be responsible for that piece of data and then the request is forwarded using local.comm.send to the node's local service. This is done in order to take advantage of combining the storage capabilities of multiple machines. The key challenges included handling filesystem persistence in a robust manner.


## Correctness & Performance Characterization

I characterized the correctness using the provided milestone and scenario tests to focus on making sure my put/get/del services exhibited expected behaviors and returned errros when appropriate. I wrote additional student tests to cover basic interactions between the various services such as storing and retrieving the same objects and overwriting via put and ensuring del returns the removed object correctly.


I characterized the performance of my implementation by creating two scripts. The first is called run_node.js and it simply starts a node using the node.start function. I created another file to characterize performance called cloud_benchmark.js which accomplishes exactly what was asked of us in the cloud storage characterization section of the handout. The script is to be ran from a client node. It first stores references to 3 different nodes which are to be used for the client to contact them either locally or through the cloud in the case where each node is a different AWS EC2 instance. The client then issues the 1000 requests in stages to insert the 1000 random objects in the distributed key/value store. It then queries all objects by key and finally measures the latency and throughput. I then made sure I had 4 AWS EC2 instances. I sshed into all of them using 4 terminals on my computer. The first was the client and the other 3 each were nodes. For each of the nodes I ran the run_node.js file in order to start the node up and then on my client I ran my cloud_benchmark.js script and measured performance. I was able to do the same locally by just starting four terminals in the same manner.


## Key Feature

> Why is the `reconf` method designed to first identify all the keys to be relocated and then relocate individual objects instead of fetching all the objects immediately and then pushing them to their corresponding locations?


# M5: Distributed Execution Engine


## Summary

> Summarize your implementation, including key challenges you encountered. Remember to update the `report` section of the `package.json` file with the total number of hours it took you to complete each task of M5 (`hours`) and the lines of code per task.


My implementation comprises new software components for a distributed MapReduce execution engine, including the distributed `mr` service, support for shuffle-stage grouping, updates to the distributed and local storage layers for intermediate MapReduce data, and new scenario and student tests. In total, this milestone added a few hundred lines of code over the previous implementation.

Key challenges included coordinating the full MapReduce lifecycle across multiple nodes, correctly handling shuffle-stage data placement, and debugging differences between the local environment and Gradescope. One challenge was making sure the coordinator dynamically registered a unique MR service and orchestrated the phases in the right order. Another challenge was implementing shuffle so that mapped outputs with the same key were grouped on the same node using the store layer’s append behavior. A major debugging challenge was that the implementation passed local tests but failed on Gradescope because workers attempted to process keys they did not own locally; I addressed this by treating missing local files as keys to skip during the map and reduce phases rather than as fatal errors. I also had to ensure that gid values were preserved correctly in the distributed store so that intermediate shuffle data was written and read from the proper group.


## Correctness & Performance Characterization

> Describe how you characterized the correctness and performance of your implementation


*Correctness*: I wrote 5 student test cases testing basic MapReduce behavior, including single-key map-reduce execution, missing-key handling, grouped counting behavior, and simple reduction logic. I also implemented 3 scenarios and used the provided `all.mr` tests (`ncdc`, `avgwrdl`, and `cfreq`) to validate the full distributed workflow. Together, these tests checked setup, map, shuffle, reduce, dynamic service installation, and distributed storage interactions.

*Performance*: I characterized performance by benchmarking the `dlib` workflow on my local machine. I preloaded the distributed text dataset across the worker nodes and then ran the full MapReduce computation repeatedly, measuring total runtime, average latency per run, and throughput in runs per second. My implementation parallelizes the map phase across all nodes, groups intermediate outputs during shuffle, and executes reduction over the shuffled key partitions. Over 30 runs, the workflow achieved an average latency of 0.052727 seconds per run and a throughput of 18.9367 runs per second.


## Key Feature

I did not implement any of the extra features for this milestone
