// server.broken-output.ts: той самий сервер, але check_freshness повертає
// structuredContent, що не сходиться з власним outputSchema (checked як рядок).
//
// Навіщо окремий entry, а не тимчасова правка в server.ts: доказ має бути
// відтворюваним будь-коли, а не «я на хвилинку зламав і повернув». Той самий
// прийом, що dist/server.buggy.js у демо 8.7 — чесний і зламаний сервери
// стоять поруч і порівнюються одним рядком Inspector-а.

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { EvidenceStore } from "./store.js";
import { RULES_FILE, createServer } from "./server.js";

const store = new EvidenceStore(RULES_FILE);
store.load();

const server = createServer(store, { corruptOutput: true });
await server.connect(new StdioServerTransport());

console.error("evidence-guard (BROKEN OUTPUT) MCP server running on stdio");
