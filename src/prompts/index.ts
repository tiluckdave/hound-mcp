import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { packageEvaluationRegisterPrompt } from "./package_evaluation.js";
import { preReleaseCheckRegisterPrompt } from "./pre_release_check.js";
import { securityAuditRegisterPrompt } from "./security_audit.js";

export function registerPrompts(server: McpServer): void {
  securityAuditRegisterPrompt(server);
  packageEvaluationRegisterPrompt(server);
  preReleaseCheckRegisterPrompt(server);
}
