import assert from "node:assert/strict";
import test from "node:test";

import { TelegramProvider } from "../../../supabase/functions/_shared/telegram.ts";

test("Telegram provider exposes a failed API response", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("bad gateway", { status: 502 });

  try {
    await assert.rejects(
      new TelegramProvider("test-token").send("test", "123"),
      /Telegram 502/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
