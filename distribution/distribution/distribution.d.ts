import { GroupServices } from "./all/all.js";
import { Node } from "./types.js";
import { Server, IncomingMessage, ServerResponse } from "http";

export {};

declare global {
  var distribution: {
    util: typeof import("./util/util.js"),
    local: typeof import('./local/local.js'),
    all: GroupServices,
    node: {
      start: (server: any) => void
      config: Node
      server: Server<typeof IncomingMessage, typeof ServerResponse>
      counts: 0
    },
    [gid: string]: any,
  }
  var toLocal: Map<string, Function>
}
