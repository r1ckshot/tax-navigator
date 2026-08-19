// Інтеграційні тести MCP-шару через InMemoryTransport: справжній клієнт SDK
// говорить зі справжнім сервером, але без окремого процесу і stdio.
import { beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { fileURLToPath } from "node:url";
import { createServer } from "./server.js";
import { EvidenceStore } from "./store.js";

const FIXTURE = fileURLToPath(new URL("./__fixtures__/rules.fixture.json", import.meta.url));
const NOW = () => new Date("2026-08-19T00:00:00Z");

function firstText(result: { content?: unknown }): string {
  const content = result.content as Array<{ type: string; text: string }>;
  expect(content[0].type).toBe("text");
  return content[0].text;
}

async function connect(options: { corruptOutput?: boolean } = {}) {
  const store = new EvidenceStore(FIXTURE, NOW);
  store.load();
  const server = createServer(store, options);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, store };
}

describe("evidence-guard MCP server", () => {
  let client: Client;

  beforeEach(async () => {
    ({ client } = await connect());
  });

  it("tools/list віддає три tools, у check_freshness є outputSchema", async () => {
    const { tools } = await client.listTools();

    expect(tools.map((t) => t.name).sort()).toEqual(["check_freshness", "get_rule", "list_rules"]);

    const freshness = tools.find((t) => t.name === "check_freshness")!;
    expect(freshness.outputSchema).toBeDefined();
    expect(freshness.outputSchema!.properties).toHaveProperty("stale");
    // Опис несе контраст «коли кликати / коли ні» — саме він вирішує доречність виклику.
    expect(tools.find((t) => t.name === "get_rule")!.description).toContain("ЗАВЖДИ");
    // Усі три tools лише читають — це видно клієнту, а не тільки з коду.
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
  });

  it("list_tools зі status=stale віддає лише протерміновані", async () => {
    const text = firstText(
      await client.callTool({ name: "list_rules", arguments: { status: "stale" } }),
    );

    expect(text).toContain("fixture.ancient");
    expect(text).toContain("fixture.one_day_over");
    expect(text).not.toContain("fixture.fresh");
  });

  it("get_rule віддає цифру разом із джерелом і датою звірки", async () => {
    const text = firstText(
      await client.callTool({ name: "get_rule", arguments: { rule_id: "fixture.fresh" } }),
    );

    expect(text).toContain("https://www.zus.pl/fixture-fresh");
    expect(text).toContain("2026-08-01");
    expect(text).toContain('"monthly": 1000');
    expect(text).not.toContain("УВАГА"); // свіже правило попередження не несе
  });

  it("get_rule на протермінованому правилі додає попередження про перезвірку", async () => {
    const text = firstText(
      await client.callTool({ name: "get_rule", arguments: { rule_id: "fixture.ancient" } }),
    );

    expect(text).toContain("УВАГА");
    expect(text).toContain("перезвірити");
  });

  it("невідомий rule_id — isError з підказкою наступного кроку, а не тихий успіх", async () => {
    const result = await client.callTool({
      name: "get_rule",
      arguments: { rule_id: "fixture.nope" },
    });

    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain("list_rules");
    expect(firstText(result)).toContain("Не підставляй цифру з пам'яті");
  });

  it("невалідний вхід ріже SDK ще до handler-а", async () => {
    const result = await client.callTool({
      name: "list_rules",
      arguments: { status: "urgent" }, // поза enum
    });

    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/Invalid arguments|validation/i);
  });

  it("check_freshness повертає structuredContent за схемою", async () => {
    const result = await client.callTool({ name: "check_freshness", arguments: {} });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      tax_year: 2026,
      threshold_days: 90,
      checked: 4,
      stale: 2,
      fresh: 2,
      stalest: { rule_id: "fixture.ancient", age_days: 595 },
    });
    expect(firstText(result)).toContain("Протерміновано понад 90 дн.: 2");
  });

  it("evidence://summary читається як ресурс", async () => {
    const result = await client.readResource({ uri: "evidence://summary" });
    const text = result.contents[0].text as string;

    expect(text).toContain("Потребують перезвірки:");
    expect(text).toContain("fixture.ancient");
  });

  it("prompt verify-rule розгортає протокол для конкретного правила", async () => {
    const result = await client.getPrompt({
      name: "verify-rule",
      arguments: { rule_id: "fixture.ancient" },
    });
    const text = (result.messages[0].content as { text: string }).text;

    expect(text).toContain("fixture.ancient");
    expect(text).toContain("https://www.zus.pl/fixture-ancient");
    expect(text).toContain("Не підставляй правдоподібне число");
  });
});

describe("контракт помилок", () => {
  it("зламаний structuredContent ловить валідація виходу, а не клієнт", async () => {
    const { client: broken } = await connect({ corruptOutput: true });

    const result = await broken.callTool({ name: "check_freshness", arguments: {} });

    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain("Output validation error");
    expect(firstText(result)).toContain("check_freshness");
  });

  it("невідома помилка проходить нагору сирою, без доменної підказки", async () => {
    // Store, який падає не RuleNotFoundError, а чимось несподіваним:
    // handler такого не маскує (`throw error`), тож клієнт бачить справжню
    // причину, а не правдоподібне «правила не існує».
    const store = new EvidenceStore(FIXTURE, NOW);
    store.load();
    store.getRule = () => {
      throw new Error("rules.2026.json пошкоджений");
    };
    const server = createServer(store);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "get_rule",
      arguments: { rule_id: "fixture.fresh" },
    });

    expect(result.isError).toBe(true);
    expect(firstText(result)).toContain("rules.2026.json пошкоджений");
    expect(firstText(result)).not.toContain("Виклич list_rules");
  });
});
