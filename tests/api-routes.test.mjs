import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedRoute } from "../src/lib/api-routes.mjs";
const id = "10000000-0000-4000-8000-000000000001";
test("proxy permite só contratos internos previstos", () => {
  assert.ok(allowedRoute("GET", ["leads", id]));
  assert.ok(allowedRoute("PATCH", ["leads", id, "assignment"]));
  assert.ok(allowedRoute("POST", ["leads", id, "documents", id, "download"]));
  for (const path of [
    ["..", "pagbank", "checkout"],
    ["https://example.com"],
    ["leads", id, "payment"],
    ["leads", id, "documents", "../../secret"],
  ])
    assert.equal(allowedRoute("POST", path), false);
  assert.equal(allowedRoute("DELETE", ["leads", id]), false);
});
