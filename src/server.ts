import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const SERVER_NAME = "hound-mcp";
const SERVER_VERSION = "0.1.0";

export function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Tools are registered here as they are implemented.
  // Each tool module exports a `register(server)` function.
  // Example (uncomment as tools are added):
  //
  // import { register as registerInspect } from "./tools/inspect.js";
  // registerInspect(server);

  return server;
}
