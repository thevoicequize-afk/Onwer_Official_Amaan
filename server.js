
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

// Period format: YYYYMMDD + 10005 + 4-digit daily sequence
// Example: 20261102100050001

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { rounds: {} };
  }
}

let db = readData();

function saveData() {
  const tmp = DATA_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

// India date and time (IST)
function getIndiaDate(now = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(now));

  const get = (type) => parts.find(p => p.type === type).value;
  return `${get("year")}${get("month")}${get("day")}`;
}

// Each 30-second slot gets one period number.
// The slot is based on a shared clock, so clients stay synchronized.
function periodAt(now = Date.now()) {
  const slot = Math.floor(now / ROUND_MS);
  const start = slot * ROUND_MS;
  const end = start + ROUND_MS;
  const date = getIndiaDate(now);

  const dayStart = new Date(
    `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00+05:30`
  ).getTime();

  const dailySequence = Math.floor((start - dayStart) / ROUND_MS) + 1;

  return {
    slot,
    start,
    end,
    date,
    dailySequence
  };
}

function makePeriod(date, sequence) {
  return `${date}10005${String(sequence).padStart(4, "0")}`;
}

function resultFor(p) {
  const key = String(p.slot);

  if (!db.rounds[key]) {
    const number = crypto.randomInt(0, 10);

    const color =
      number === 0 || number === 5
        ? "Violet"
        : number % 2 === 0
          ? "Red"
          : "Green";

    const size = number >= 5 ? "Big" : "Small";

    db.rounds[key] = {
      period: makePeriod(p.date, p.dailySequence),
      slot: p.slot,
      number,
      color,
      size,
      generatedAt: new Date().toISOString(),
      source: "DEMO"
    };

    saveData();
  }

  return db.rounds[key];
}

function currentPayload() {
  const p = periodAt();
  const result = resultFor(p);

  return {
    period: result.period,
    serverTime: Date.now(),
    roundStart: p.start,
    roundEnd: p.end,
    remainingMs: Math.max(0, p.end - Date.now()),
    result
  };
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    mode: "demo",
    roundSeconds: 30
  });
});

app.get("/api/current", (_req, res) => {
  res.json(currentPayload());
});

app.get("/api/result", (_req, res) => {
  res.json(currentPayload().result);
});

app.get("/api/history", (req, res) => {
  const requested = parseInt(req.query.limit || "50", 10);
  const limit = Math.min(Math.max(requested || 50, 1), 500);

  const history = Object.values(db.rounds)
    .sort((a, b) => b.slot - a.slot)
    .slice(0, limit);

  res.json({
    source: "DEMO",
    count: history.length,
    history
  });
});

app.get("/api/live", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = () => {
    res.write(`data: ${JSON.stringify(currentPayload())}\n\n`);
  };

  send();

  const timer = setInterval(send, 1000);

  req.on("close", () => {
    clearInterval(timer);
  });
});

// Serve the website page
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }

  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`WinGo demo server listening on port ${PORT}`);
});
