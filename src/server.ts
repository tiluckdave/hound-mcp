import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerPrompts } from "./prompts/index.js";
import { register as registerAdvisories } from "./tools/advisories.js";
import { register as registerInspect } from "./tools/inspect.js";
import { register as registerPopular } from "./tools/popular.js";
import { register as registerTree } from "./tools/tree.js";
import { register as registerTyposquat } from "./tools/typosquat.js";
import { register as registerAudit } from "./tools/audit.js";
import { register as registerCompare } from "./tools/compare.js";
import { register as registerLicenseCheck } from "./tools/license-check.js";
import { register as registerPreinstall } from "./tools/preinstall.js";
import { register as registerScore } from "./tools/score.js";
import { register as registerUpgrade } from "./tools/upgrade.js";
import { register as registerVulns } from "./tools/vulns.js";

const SERVER_NAME = "hound-mcp";
const SERVER_VERSION = "0.2.0";

export function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerVulns(server);
  registerInspect(server);
  registerTree(server);
  registerTyposquat(server);
  registerAdvisories(server);
  registerPopular(server);
  registerAudit(server);
  registerCompare(server);
  registerLicenseCheck(server);
  registerPreinstall(server);
  registerScore(server);
  registerUpgrade(server);
  registerPrompts(server);

  return server;
}
