import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { isDeletableTranscript } from "../src/deleteGuard";

const home = path.resolve("/home/me");
const id = "490bb904-1323-4e40-a180-e710c8949bda";
const projects = path.join(home, ".claude", "projects");

describe("isDeletableTranscript", () => {
  it("accepts <uuid>.jsonl directly inside a project folder", () => {
    expect(isDeletableTranscript(id, path.join(projects, "-home-me-app", `${id}.jsonl`), home)).toBe(true);
  });
  it("rejects non-uuid session ids", () => {
    expect(isDeletableTranscript("../x", path.join(projects, "p", "../x.jsonl"), home)).toBe(false);
  });
  it("rejects a path whose filename does not match the session id", () => {
    expect(isDeletableTranscript(id, path.join(projects, "p", "other.jsonl"), home)).toBe(false);
  });
  it("rejects paths outside ~/.claude/projects", () => {
    expect(isDeletableTranscript(id, path.join(home, "Documents", `${id}.jsonl`), home)).toBe(false);
    expect(isDeletableTranscript(id, path.join(projects, "p", "..", "..", "..", `${id}.jsonl`), home)).toBe(false);
  });
});
