import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseSseBlocks } from "../assets/ts/airstrike-animation-editor/editor/agent";

describe("airstrike agent SSE parsing", () => {
  it("parses fetch-streamed events with CRLF framing and JSON payloads", () => {
    const parsed = parseSseBlocks(
      'event: text_delta\r\ndata: {"delta":"first"}\r\n\r\nevent: tool_started\r\ndata: {"name":"replace_route"}\r\n\r\n',
    );

    expect(parsed.remainder).toBe("");
    expect(parsed.events).toEqual([
      { event: "text_delta", data: { delta: "first" } },
      { event: "tool_started", data: { name: "replace_route" } },
    ]);
  });

  it("retains an incomplete block until the next streamed chunk arrives", () => {
    const first = parseSseBlocks('event: proposal\ndata: {"id":42');
    expect(first.events).toEqual([]);

    const second = parseSseBlocks(`${first.remainder},"status":"proposed"}\n\n`);
    expect(second.remainder).toBe("");
    expect(second.events).toEqual([
      { event: "proposal", data: { id: 42, status: "proposed" } },
    ]);
  });

  it("joins multiline SSE data before decoding", () => {
    const parsed = parseSseBlocks('event: completed\ndata: {"ok":true,\ndata: "rounds":2}\n\n');
    expect(parsed.events).toEqual([{ event: "completed", data: { ok: true, rounds: 2 } }]);
  });
});

describe("airstrike agent editor integration contract", () => {
  it("keeps the dock, proposal workflow, save attribution, and ghost preview wired together", async () => {
    const [markup, app, viewport] = await Promise.all([
      readFile(resolve("admin/airstrike-animation-editor.php"), "utf8"),
      readFile(resolve("assets/ts/airstrike-animation-editor/app.ts"), "utf8"),
      readFile(resolve("assets/ts/airstrike-animation-editor/editor/viewport.ts"), "utf8"),
    ]);

    expect(markup).toContain('data-editor-right-tab="agent"');
    expect(markup).toContain('data-editor-tool-card="ordnance"');
    expect(markup).toContain('data-editor-tool-dialog="flight-path"');
    expect(markup).toContain('data-editor-tool-ai="ordnance"');
    expect(markup).toContain('data-agent-context-rail data-agent-scope="ordnance"');
    expect(markup).toContain("data-agent-apply");
    expect(markup).toContain("data-agent-discard");
    expect(markup).toContain("data-agent-undo");
    expect(markup).toContain("data-agent-rerun");
    expect(app).toContain("agentProposalId: this.agent.proposalIdForSave()");
    expect(app).toContain("commitWorkspaceProposal");
    expect(app).toContain("canonicalJson(this.toolSession.profile)");
    expect(viewport).toContain('route.name = "agent-proposal-route"');
    expect(viewport).toContain("getReleasePreviewEvents(profile, this.options.metadata)");
  });
});
