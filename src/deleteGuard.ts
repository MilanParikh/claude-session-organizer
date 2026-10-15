import * as os from "node:os";
import * as path from "node:path";

const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Only allow deleting `<uuid>.jsonl` directly inside a ~/.claude/projects/<dir>/ folder.
 * Commands can be invoked by other extensions with arbitrary arguments.
 */
export function isDeletableTranscript(sessionId: string, filePath: string, homeDir = os.homedir()): boolean {
  if (!SESSION_ID_RE.test(sessionId)) return false;
  const resolved = path.resolve(filePath);
  if (path.basename(resolved) !== `${sessionId}.jsonl`) return false;
  const projectsRoot = path.join(homeDir, ".claude", "projects");
  return path.dirname(path.dirname(resolved)) === projectsRoot;
}
