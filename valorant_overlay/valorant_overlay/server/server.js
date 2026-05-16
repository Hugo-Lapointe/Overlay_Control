// server.js - minimal express + ws server for the overlay
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 25565;
const API_TOKEN = process.env.OVERLAY_TOKEN || '';

// load initial config/state if exists
const CONFIG_PATH = path.join(__dirname, '..', 'config', 'teams.json');
let state = {
  left: { name: 'LEFT', logo: '', score: 0 },
  right: { name: 'RIGHT', logo: '', score: 0 },
  live: { round: null, timer: '', phase: '' }
};
try {
  const cfg = fs.readFileSync(CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(cfg);
  if (parsed.left) state.left = Object.assign(state.left, parsed.left);
  if (parsed.right) state.right = Object.assign(state.right, parsed.right);
} catch (err) {
  // no config or parse error = ok, proceed with defaults
}

// middleware
app.use(cors());
app.use(bodyParser.json());
// serve static files from ./static
app.use('/', express.static(path.join(__dirname, 'static')));

function isAuthorized(req) {
  if (!API_TOKEN) return true;
  const token = req.headers['x-overlay-token'] || req.query.token;
  return token === API_TOKEN;
}

// Convenience route for GET (older clients)
app.get('/state', (req, res) => {
  res.json({ ok: true, state });
});

// API for get/save state
app.get('/api/state', (req, res) => {
  res.json({ ok: true, state });
});

app.post('/api/state', (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const newState = req.body;
  if (!newState) {
    return res.status(400).json({ ok: false, error: 'missing state' });
  }
  // merge shallow (expected format left/right)
  if (newState.left) state.left = Object.assign({}, state.left, newState.left);
  if (newState.right) state.right = Object.assign({}, state.right, newState.right);
  if (newState.live) state.live = Object.assign({}, state.live, newState.live);

  console.log('State updated:', JSON.stringify(state));
  // broadcast to all ws clients
  broadcast({ type: 'state', state });
  res.json({ ok: true, state });
});

// helper: broadcast to all connected ws clients
function broadcast(obj) {
  const raw = JSON.stringify(obj);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(raw);
  });
  console.log('Broadcasted state to', wss.clients.size, 'clients');
}

wss.on('connection', (ws, req) => {
  console.log('ws client connected');

  // send current state to any new client (overlay, control panel, scraper)
  try {
    ws.send(JSON.stringify({ type: 'state', state }));
  } catch (e) {}

  ws.on('message', (message) => {
    let data;
    try {
      data = JSON.parse(message.toString());
    } catch (err) {
      console.error('ws parse error:', err);
      return;
    }

    // Expect scraper messages like { type:"state", state:{...}, token:"..." }
    if (data && data.type === 'state' && data.state) {
      if (API_TOKEN && data.token !== API_TOKEN) {
        console.warn('ws unauthorized state update attempt');
        return;
      }

      const incoming = data.state;
      if (incoming.left) {
        state.left = Object.assign({}, state.left, incoming.left);
      }
      if (incoming.right) {
        state.right = Object.assign({}, state.right, incoming.right);
      }
      if (incoming.live) {
        state.live = Object.assign({}, state.live, incoming.live);
      }

      console.log('State updated from ws:', JSON.stringify(state));
      broadcast({ type: 'state', state });
    } else {
      console.log('ws message from client (ignored):', message.toString());
    }
  });

  ws.on('close', () => {
    console.log('ws client disconnected');
  });
});


// start
server.listen(PORT, '0.0.0.0', () => {
  console.log('Ready (Stage 1)');
  console.log('Server running at http://0.0.0.0:' + PORT);
  if (API_TOKEN) {
    console.log('Overlay token protection is enabled. Use x-overlay-token header or ?token=... on POST requests.');
  }
});
