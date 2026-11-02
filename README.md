# WinGo 30S Personal Demo Server

This is a **demo-only** synchronized 30-second game API. It does not connect to RAXI18 and does not reproduce its real results.

## Run locally
1. Install Node.js 18 or newer.
2. In this folder run `npm install`
3. Run `npm start`
4. Open `http://localhost:3000`

## API
- `GET /api/health` — health check
- `GET /api/current` — current period, server time, round end, remaining milliseconds and demo result
- `GET /api/result` — current demo result
- `GET /api/history?limit=50` — recent demo results
- `GET /api/live` — Server-Sent Events stream, updates every second

## Deploy
Deploy this folder as a Node web service on a hosting provider that supports Node.js. Set the start command to `npm start` and use the assigned `PORT`.

**Persistence note:** this starter stores results in `data.json`. Some free hosting plans use temporary filesystems or restart services; use a managed database for durable production persistence.

## Result rules
One result is generated once per 30-second server period and stored under its period slot. All clients connected to this same server see the same period and result. The values are randomly generated demo values, not predictions or RAXI18 data.
