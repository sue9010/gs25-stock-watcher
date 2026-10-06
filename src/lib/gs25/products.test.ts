import assert from "node:assert/strict";
import test from "node:test";

import { Gs25ApiError, searchGs25Products } from "./products.ts";

test("GS25 API failure retries twice and then fails", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response("unavailable", { status: 503 });
  };

  try {
    await assert.rejects(
      searchGs25Products("민음사", 20),
      (error: unknown) => error instanceof Gs25ApiError && error.status === 503,
    );
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
