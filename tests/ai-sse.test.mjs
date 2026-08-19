import assert from "node:assert/strict";
import test from "node:test";
import { readSseEvents } from "../lib/ai-sse.ts";

test("parses SSE events with CRLF separators", () => {
  const result = readSseEvents(
    "event: content\r\ndata: {\"delta\":\"hello\"}\r\n\r\nevent: done\r\ndata: {}\r\n\r\n"
  );

  assert.deepEqual(result.events, [
    { event: "content", data: { delta: "hello" } },
    { event: "done", data: {} },
  ]);
  assert.equal(result.remainder, "");
});

test("retains an incomplete final event for the next chunk", () => {
  const result = readSseEvents("event: reasoning\ndata: {\"delta\":\"par");

  assert.deepEqual(result.events, []);
  assert.equal(result.remainder, "event: reasoning\ndata: {\"delta\":\"par");
});

test("joins multi-line SSE data before parsing JSON", () => {
  const result = readSseEvents("event: content\ndata: {\"delta\":\ndata: \"hello\"}\n\n");

  assert.deepEqual(result.events, [{ event: "content", data: { delta: "hello" } }]);
});

test("flushes a complete final event even when the provider omits the trailing blank line", () => {
  const result = readSseEvents('data: {"choices":[{"delta":{"content":"last"}}]}', { flush: true });

  assert.deepEqual(result.events, [{
    event: "message",
    data: { choices: [{ delta: { content: "last" } }] },
  }]);
  assert.equal(result.remainder, "");
});
