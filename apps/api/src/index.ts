import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Hono c.json() return type is not resolvable by typescript-eslint
  return c.json({ status: "ok" });
});

export default app;
