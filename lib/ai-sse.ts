export type ParsedSseEvent = {
  event: string;
  data: unknown;
};

export function readSseEvents(buffer: string, options: { flush?: boolean } = {}) {
  const events: ParsedSseEvent[] = [];
  const normalized = buffer.replace(/\r\n/g, "\n");
  const chunks = normalized.split("\n\n");
  const remainder = options.flush ? "" : chunks.pop() || "";

  for (const chunk of chunks) {
    if (!chunk) continue;
    const lines = chunk.split("\n");
    const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim() || "message";
    const data = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    try {
      events.push({ event, data: JSON.parse(data) });
    } catch {
      // Ignore malformed complete events and continue with the next one.
    }
  }

  return { events, remainder };
}
