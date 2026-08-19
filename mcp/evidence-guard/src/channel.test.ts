// Тести каналу: напрямок «сервер → сесія» (нотифікація), відповідь назад
// (ack_event) і HTTP-вхід як його бачить curl.
import { afterEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { fileURLToPath } from "node:url";
import { createChannel, createHttpServer, startChannelHttp } from "./channel.js";
import { EvidenceStore } from "./store.js";
import { SECRET_HEADER, type ChannelEvent } from "./webhook.js";

const FIXTURE = fileURLToPath(new URL("./__fixtures__/rules.fixture.json", import.meta.url));
const NOW = () => new Date("2026-08-19T10:00:00Z");
const TOKEN = "s3cret-token";

const sampleEvent: ChannelEvent = {
  event_id: "evt-1",
  source: "zus.pl",
  rule_id: "fixture.ancient",
  url: "https://www.zus.pl/skladki-2027",
  changed_at: "2026-08-19",
  received_at: "2026-08-19T10:00:00.000Z",
};

function firstText(result: { content?: unknown }): string {
  const content = result.content as Array<{ type: string; text: string }>;
  return content[0].text;
}

async function connectChannel(ackFile?: string) {
  const store = new EvidenceStore(FIXTURE, NOW);
  store.load();
  const channel = createChannel(store, { ackFile, now: NOW });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const notifications: Array<{ method: string; params?: Record<string, unknown> }> = [];
  client.fallbackNotificationHandler = async (notification) => {
    notifications.push(notification as { method: string; params?: Record<string, unknown> });
  };
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([channel.mcp.connect(serverTransport), client.connect(clientTransport)]);
  return { channel, client, notifications };
}

describe("канал: сервер сам штовхає подію в сесію", () => {
  it("оголошує capability claude/channel — саме вона робить сервер каналом", async () => {
    const { client } = await connectChannel();

    expect(client.getServerCapabilities()?.experimental).toHaveProperty("claude/channel");
  });

  it("push доставляє нотифікацію notifications/claude/channel з подією", async () => {
    const { channel, notifications } = await connectChannel();

    const delivered = await channel.push(sampleEvent);

    expect(delivered).toBe(true);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].method).toBe("notifications/claude/channel");
    const params = notifications[0].params as { content: string; meta: Record<string, string> };
    expect(params.content).toContain("fixture.ancient");
    expect(params.content).toContain("evt-1");
    expect(params.meta).toMatchObject({ event_id: "evt-1", rule_id: "fixture.ancient" });
  });

  it("push без підключеного транспорту повертає false, а не вдає доставку", async () => {
    const store = new EvidenceStore(FIXTURE, NOW);
    store.load();
    const channel = createChannel(store, { now: NOW });

    expect(await channel.push(sampleEvent)).toBe(false);
  });

  it("канал віддає ті самі три evidence-tools плюс ack_event", async () => {
    const { client } = await connectChannel();

    const names = (await client.listTools()).tools.map((t) => t.name).sort();

    expect(names).toEqual(["ack_event", "check_freshness", "get_rule", "list_rules"]);
  });
});

describe("канал: відповідь назад", () => {
  const ackFile = path.join(os.tmpdir(), `evidence-guard-acks-${process.pid}.json`);

  afterEach(() => {
    fs.rmSync(ackFile, { force: true });
  });

  it("ack_event на невідому подію — isError з підказкою, а не тихий запис", async () => {
    const { client } = await connectChannel(ackFile);

    const result = await client.callTool({
      name: "ack_event",
      arguments: { event_id: "evt-999", verdict: "no-change" },
    });

    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain("не вигадуй");
    expect(fs.existsSync(ackFile)).toBe(false);
  });

  it("ack_event на доставлену подію лишає слід на диску", async () => {
    const { channel, client } = await connectChannel(ackFile);
    await channel.push(sampleEvent);

    const result = await client.callTool({
      name: "ack_event",
      arguments: { event_id: "evt-1", verdict: "needs-reverify", note: "джерело оновило таблицю" },
    });

    expect(result.isError).toBeFalsy();
    expect(firstText(result)).toContain("needs-reverify");
    const saved = JSON.parse(fs.readFileSync(ackFile, "utf8"));
    expect(saved).toEqual([
      {
        event_id: "evt-1",
        rule_id: "fixture.ancient",
        verdict: "needs-reverify",
        note: "джерело оновило таблицю",
        acked_at: "2026-08-19T10:00:00.000Z",
      },
    ]);
  });
});

describe("канал: HTTP-вхід очима curl", () => {
  let server: Server;
  const pushed: ChannelEvent[] = [];

  async function listen(token: string | undefined = TOKEN): Promise<string> {
    server = createHttpServer({
      token,
      push: async (event) => {
        pushed.push(event);
        return true;
      },
      newId: () => `evt-${pushed.length + 1}`,
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  afterEach(async () => {
    pushed.length = 0;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("POST /webhook без секрета — 401 і жодної події", async () => {
    const base = await listen();

    const response = await fetch(`${base}/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        source: "zus.pl",
        rule_id: "fixture.ancient",
        url: "https://www.zus.pl/x",
        changed_at: "2026-08-19",
      }),
    });

    expect(response.status).toBe(401);
    expect(pushed).toHaveLength(0);
  });

  it("POST /webhook із секретом — 202 і подія в каналі", async () => {
    const base = await listen();

    const response = await fetch(`${base}/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", [SECRET_HEADER]: TOKEN },
      body: JSON.stringify({
        source: "zus.pl",
        rule_id: "fixture.ancient",
        url: "https://www.zus.pl/x",
        changed_at: "2026-08-19",
        note: "таблиця складок оновлена",
      }),
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ status: "accepted", pushed: true });
    expect(pushed).toHaveLength(1);
    expect(pushed[0].rule_id).toBe("fixture.ancient");
  });

  it("без секрета порт не відкривається взагалі, а не відповідає 503", () => {
    expect(startChannelHttp({ token: undefined, port: 0, push: async () => true })).toBeNull();
  });

  it("GET /healthz — 200, будь-що інше — 404", async () => {
    const base = await listen();

    expect((await fetch(`${base}/healthz`)).status).toBe(200);
    expect((await fetch(`${base}/anything`)).status).toBe(404);
  });
});
