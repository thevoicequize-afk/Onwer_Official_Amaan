const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const ROUND_MS = 30_000;
const DATA_FILE = path.join(__dirname, "data.json");
const PREFIX = process.env.PERIOD_PREFIX || "DEMO";

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return { rounds: {} }; }
}
let db = readData();

function saveData() {
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

// A single server clock defines round boundaries for every connected client.
// Demo results are generated once per period and persisted.
function periodAt(now = Date.now()) {
  const slot = Math.floor(now / ROUND_MS);
  return { slot, start: slot * ROUND_MS, end: (slot + 1) * ROUND_MS };
}
function resultFor(slot) {
  const key = String(slot);
  if (!db.rounds[key]) {
    const n = crypto.randomInt(0, 10);
    const color = n === 0 || n === 5 ? "Violet" : (n % 2 === 0 ? "Red" : "Green");
    const size = n >= 5 ? "Big" : "Small";
    db.rounds[key] = {
      period: `${PREFIX}${slot}`,
      slot, number: n, color, size,
      generatedAt: new Date().toISOString(),
      source: "DEMO"
    };
    saveData();
  }
  return db.rounds[key];
}
function currentPayload() {
  const p = periodAt();
  const result = resultFor(p.slot);
  return {
    period: result.period,
    serverTime: Date.now(),
    roundStart: p.start,
    roundEnd: p.end,
    remainingMs: Math.max(0, p.end - Date.now()),
    result
  };
}

app.get("/api/health", (_req, res) => res.json({ ok: true, mode: "demo", roundSeconds: 30 }));
app.get("/api/current", (_req, res) => res.json(currentPayload()));
app.get("/api/result", (_req, res) => res.json(currentPayload().result));
app.get("/api/history", (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 500);
  const items = Object.values(db.rounds).sort((a,b) => b.slot - a.slot).slice(0, limit);
  res.json({ source: "DEMO", count: items.length, history: items });
});

// Server-Sent Events: clients receive a fresh synchronized snapshot every second.
app.get("/api/live", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  const send = () => res.write(`data: ${JSON.stringify(currentPayload())}\n\n`);
  send();
  const timer = setInterval(send, 1000);
  req.on("close", () => clearInterval(timer));
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`WinGo demo API listening on ${PORT}`));
