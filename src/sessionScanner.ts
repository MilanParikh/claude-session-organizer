import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { SessionMeta } from "./types";

const SYSTEM_PREFIXES = ["<ide_opened_file>", "<ide_selection>", "<system-reminder>", "<command-name>", "<command-message>", "<local-command-stdout>"];
const MAX_TITLE = 60;

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c) => c && typeof c === "object" && (c as { type?: string }).type === "text")
      .map((c) => (c as { text?: string }).text ?? "")
      .join(" ");
  }
  return "";
}

function isSystemInjected(text: string): boolean {
  return SYSTEM_PREFIXES.some((p) => text.startsWith(p));
}

function truncate(text: string): string {
  return text.length > MAX_TITLE ? text.slice(0, MAX_TITLE - 1) + "…" : text;
}

/**
 * Title for a session transcript: the latest `/rename` title (custom-title), else the
 * latest AI-generated title (ai-title), else the first human-typed prompt, else "".
 * Claude Code re-emits these title lines throughout the file, so the last one wins.
 */
export function titleOf(jsonlText: string): string {
  let customTitle = "";
  let aiTitle = "";
  let firstPrompt = "";
  for (const line of jsonlText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj: any;
    try { obj = JSON.parse(trimmed); } catch { continue; }
    if (obj?.type === "custom-title" && typeof obj.customTitle === "string") {
      customTitle = obj.customTitle.replace(/\s+/g, " ").trim() || customTitle;
      continue;
    }
    if (obj?.type === "ai-title" && typeof obj.aiTitle === "string") {
      aiTitle = obj.aiTitle.replace(/\s+/g, " ").trim() || aiTitle;
      continue;
    }
    if (firstPrompt || obj?.type !== "user" || obj?.message?.role !== "user") continue;
    const text = extractText(obj.message.content).replace(/\s+/g, " ").trim();
    if (!text || isSystemInjected(text)) continue;
    firstPrompt = text;
  }
  return truncate(customTitle || aiTitle || firstPrompt);
}

function fallbackTitle(sessionId: string): string {
  return `Session ${sessionId.slice(0, 8)}`;
}

/** Titles cached by transcript path; reused while the file's mtime and size are unchanged. */
const titleCache = new Map<string, { mtimeMs: number; size: number; title: string }>();

/** Scan a ~/.claude/projects/<encoded> directory into session metadata, mtime desc. */
export async function scanSessions(projectsDir: string): Promise<SessionMeta[]> {
  let entries: string[];
  try { entries = await fs.readdir(projectsDir); }
  catch { return []; }

  const out: SessionMeta[] = [];
  for (const name of entries) {
    if (!name.endsWith(".jsonl")) continue;
    const sessionId = name.slice(0, -".jsonl".length);
    const full = path.join(projectsDir, name);
    try {
      const stat = await fs.stat(full);
      let cached = titleCache.get(full);
      if (!cached || cached.mtimeMs !== stat.mtimeMs || cached.size !== stat.size) {
        const text = await fs.readFile(full, "utf8");
        cached = { mtimeMs: stat.mtimeMs, size: stat.size, title: titleOf(text) };
        titleCache.set(full, cached);
      }
      const title = cached.title || fallbackTitle(sessionId);
      out.push({ sessionId, mtimeMs: stat.mtimeMs, title, filePath: full });
    } catch { /* skip unreadable file */ }
  }
  out.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return out;
}
