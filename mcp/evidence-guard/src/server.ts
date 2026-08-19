// server.ts: MCP-шар поверх EvidenceStore.
// Три примітиви протоколу на реальних даних цього репо:
//   - Tools (list_rules, get_rule, check_freshness) — дії, які модель кличе сама
//   - Resource (evidence://summary) — дані, які підкладаються у контекст
//   - Prompt (verify-rule) — шаблон перезвірки цифри за evidence-numbers.md
//
// Домен навмисно не "задачки": сервер віддає МЕТАдані довіри до цифр
// (source_url, verified_at, вік), а не поради. Причина в описах tools нижче.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { completable } from "@modelcontextprotocol/sdk/server/completable.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import {
  DEFAULT_MAX_AGE_DAYS,
  EvidenceStore,
  RuleNotFoundError,
  type RuleFreshness,
} from "./store.js";

// Шлях рахуємо від модуля, а не від cwd: MCP-клієнт запускає сервер
// з довільної директорії (у Claude Code — з кореня проєкту, в Inspector — ні).
export const RULES_FILE = fileURLToPath(
  new URL("../../../app/lib/rules/rules.2026.json", import.meta.url),
);

// Усі tool-результати у MCP мають форму { content: [...] }.
function textResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function formatRuleLine(rule: RuleFreshness): string {
  const mark = rule.stale ? "СТАРЕ" : "свіже";
  return `- ${rule.rule_id} — ${mark}, звірено ${rule.verified_at} (${rule.age_days} дн. тому) — ${rule.source_url}`;
}

// Схема виходу check_freshness. Оголошена окремо, бо її використовують двоє:
// registerTool (SDK віддає її у tools/list і валідує structuredContent)
// і server.broken-output.ts, який навмисно повертає невідповідний об'єкт.
export const freshnessOutputSchema = {
  tax_year: z.number().int().describe("Податковий рік, за який зібрані правила"),
  threshold_days: z.number().int().describe("Поріг у днях, за яким правило вважається старим"),
  checked: z.number().int().describe("Скільки правил перевірено"),
  stale: z.number().int().describe("Скільки правил старші за поріг"),
  fresh: z.number().int().describe("Скільки правил у межах порогу"),
  stalest: z
    .object({
      rule_id: z.string().describe("Ідентифікатор найстарішого правила"),
      verified_at: z.string().describe("Дата останньої звірки, ISO 8601"),
      age_days: z.number().int().describe("Вік звірки у днях"),
    })
    .optional()
    .describe("Правило з найдавнішою звіркою, якщо правила взагалі є"),
  generated_at: z.string().describe("Момент формування звіту, ISO 8601"),
};

export interface CreateServerOptions {
  // Навмисна поломка structuredContent для кроку 3 капстоуна: віддати рядок
  // там, де схема чекає число. Живе тут, а не в копії сервера, щоб зламаний
  // і чесний шляхи не розійшлись при наступній правці.
  corruptOutput?: boolean;
  // Канальний режим (channel.ts) додає до цього ж сервера свої tools.
  name?: string;
}

export function createServer(store: EvidenceStore, options: CreateServerOptions = {}): McpServer {
  const server = new McpServer({
    name: options.name ?? "evidence-guard",
    version: "1.0.0",
  });

  registerEvidenceTools(server, store, options);
  return server;
}

export function registerEvidenceTools(
  server: McpServer,
  store: EvidenceStore,
  options: CreateServerOptions = {},
): void {
  // ─── TOOL 1: list_rules ───
  // Description несе контраст "коли кликати / коли НЕ кликати" — саме він
  // вирішує, чи модель піде за даними, чи відповість зі своєї пам'яті.
  server.registerTool(
    "list_rules",
    {
      title: "List rules",
      description:
        "Повертає перелік податкових правил проєкту з датою останньої звірки з офіційним джерелом. " +
        "Використовуй, коли треба дізнатись, ЯКІ правила існують і які з них варто перезвірити. " +
        "НЕ використовуй як джерело самих ставок — сум і відсотків тут немає, їх віддає get_rule.",
      inputSchema: {
        status: z
          .enum(["all", "stale", "fresh"])
          .default("all")
          .describe("Фільтр: all — усі, stale — старші за поріг, fresh — у межах порогу"),
        max_age_days: z
          .number()
          .int()
          .positive()
          .default(DEFAULT_MAX_AGE_DAYS)
          .describe("Поріг у днях, після якого звірка вважається застарілою"),
      },
      // Читальний tool: нічого не міняє, повторний виклик дає те саме.
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ status, max_age_days }) => {
      const rules = store.listRules(status, max_age_days);
      if (rules.length === 0) {
        return textResult(`Правил зі статусом "${status}" немає (поріг ${max_age_days} дн.).`);
      }
      return textResult(
        [`Правил: ${rules.length} (поріг ${max_age_days} дн.)`, ...rules.map(formatRuleLine)].join(
          "\n",
        ),
      );
    },
  );

  // ─── TOOL 2: get_rule ───
  // Тут живе error-контракт: невідомий rule_id — не криза, а розвилка,
  // на якій модель має піти по список, а не вигадати цифру.
  server.registerTool(
    "get_rule",
    {
      title: "Get rule",
      description:
        "Повертає одне правило: його параметри (ставки, пороги, ліміти), посилання на офіційне джерело " +
        "і дату останньої звірки. Використовуй ЗАВЖДИ, коли потрібна конкретна цифра податкового правила — " +
        "цифра з пам'яті моделі може бути застарілою на цілий рік. " +
        "Повертає дані, а не пораду: рішення за людиною.",
      inputSchema: {
        rule_id: z
          .string()
          .min(1)
          .describe("Ідентифікатор правила, наприклад common.minimum_wage"),
        max_age_days: z
          .number()
          .int()
          .positive()
          .default(DEFAULT_MAX_AGE_DAYS)
          .describe("Поріг у днях, після якого звірка вважається застарілою"),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ rule_id, max_age_days }) => {
      try {
        const rule = store.getRule(rule_id, max_age_days);
        const warning = rule.stale
          ? `\n\nУВАГА: звірка з джерелом була ${rule.age_days} дн. тому (поріг ${max_age_days}). ` +
            "Перед показом цифри користувачу її треба перезвірити за source_url."
          : "";
        return textResult(JSON.stringify(rule, null, 2) + warning);
      } catch (error) {
        if (error instanceof RuleNotFoundError) {
          return {
            ...textResult(
              `Правила з id "${rule_id}" немає у rules.2026.json. ` +
                "Виклич list_rules, щоб побачити наявні id. " +
                "Не підставляй цифру з пам'яті замість відсутнього правила.",
            ),
            isError: true,
          };
        }
        throw error; // невідомі помилки не маскуємо
      }
    },
  );

  // ─── TOOL 3: check_freshness (outputSchema + structuredContent) ───
  server.registerTool(
    "check_freshness",
    {
      title: "Check freshness",
      description:
        "Зведення про свіжість усієї бази правил: скільки звірок протерміновано і яка найдавніша. " +
        "Використовуй перед сезонною перевіркою цифр або коли треба одним числом оцінити, " +
        "наскільки даним репозиторію можна довіряти сьогодні.",
      inputSchema: {
        max_age_days: z
          .number()
          .int()
          .positive()
          .default(DEFAULT_MAX_AGE_DAYS)
          .describe("Поріг у днях, після якого звірка вважається застарілою"),
      },
      outputSchema: freshnessOutputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ max_age_days }) => {
      const report = store.freshness(max_age_days);
      const structuredContent = options.corruptOutput
        ? // Навмисна поломка: схема чекає число, віддаємо рядок.
          { ...report, checked: String(report.checked) }
        : { ...report };
      return {
        ...textResult(
          [
            `Правил у базі: ${report.checked} (податковий рік ${report.tax_year})`,
            `Протерміновано понад ${report.threshold_days} дн.: ${report.stale}`,
            report.stalest
              ? `Найдавніша звірка: ${report.stalest.rule_id} — ${report.stalest.verified_at} (${report.stalest.age_days} дн.)`
              : "Найдавнішої звірки немає — база порожня",
          ].join("\n"),
        ),
        structuredContent: structuredContent as Record<string, unknown>,
      };
    },
  );

  // ─── RESOURCE: evidence://summary ───
  // READ-канал: користувач може підкласти зведення через @-mention,
  // не витрачаючи виклик tool.
  server.registerResource(
    "summary",
    "evidence://summary",
    {
      title: "Evidence summary",
      description: "Скільки правил у базі, скільки звірок протерміновано, які саме.",
      mimeType: "text/plain",
    },
    async (uri) => {
      const report = store.freshness();
      const stale = store.listRules("stale");
      const missing = store.missingEvidence();
      const lines = [
        `Податковий рік: ${report.tax_year}`,
        `Правил: ${report.checked}, протерміновано (>${report.threshold_days} дн.): ${report.stale}`,
        "",
        stale.length > 0 ? "Потребують перезвірки:" : "Протермінованих звірок немає.",
        ...stale.map(formatRuleLine),
      ];
      if (missing.length > 0) {
        lines.push("", `БЕЗ source_url або verified_at: ${missing.join(", ")}`);
      }
      return {
        contents: [{ uri: uri.href, mimeType: "text/plain", text: lines.join("\n") }],
      };
    },
  );

  // ─── PROMPT: verify-rule ───
  // Шаблон явного виклику людиною: розгортає протокол evidence-numbers.md
  // у конкретні кроки для конкретного правила.
  server.registerPrompt(
    "verify-rule",
    {
      title: "Verify one rule",
      description: "Протокол перезвірки однієї цифри з джерелом за .claude/rules/evidence-numbers.md.",
      argsSchema: {
        rule_id: completable(
          z.string().describe("Яке правило перезвіряємо"),
          (value) =>
            store
              .listRules("all")
              .map((rule) => rule.rule_id)
              .filter((id) => id.startsWith(value ?? ""))
              .slice(0, 20),
        ),
      },
    },
    ({ rule_id }) => {
      let known: RuleFreshness | undefined;
      try {
        known = store.getRule(rule_id);
      } catch {
        known = undefined; // невідомий id — шаблон все одно корисний
      }
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: [
                `Перезвір правило ${rule_id} за протоколом .claude/rules/evidence-numbers.md.`,
                known
                  ? `Поточний стан: звірено ${known.verified_at} (${known.age_days} дн. тому), джерело ${known.source_url}`
                  : `Правила ${rule_id} у базі немає — спершу виклич list_rules.`,
                "",
                "Кроки:",
                "1. Відкрий source_url і знайди чинну цифру.",
                "2. Джерело недоступне — зупинись і скажи про це. Не підставляй правдоподібне число.",
                "3. Цифра збіглась — онови лише verified_at.",
                "4. Цифра змінилась — онови params, verified_at і рядок у docs/EVIDENCE.md.",
                "5. Покажи діф перед записом.",
              ].join("\n"),
            },
          },
        ],
      };
    },
  );
}

// Запуск як окремого процесу. Guard потрібен, щоб тести імпортували
// createServer без побічного ефекту "сервер раптом слухає stdin".
const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const store = new EvidenceStore(RULES_FILE);
  store.load();

  const server = createServer(store);
  await server.connect(new StdioServerTransport());

  // stdout зайнятий JSON-RPC: будь-який console.log ламає парсер клієнта.
  console.error(`evidence-guard MCP server running on stdio (${RULES_FILE})`);
}
