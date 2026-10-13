require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// UNIVERSAL KEYAUTH & BR.MODS AUTH HANDLER
// -------------------------------------------------------------
function handleAuthRequest(req, res) {
  let body = req.body || {};

  // Case 1: Body is wrapped in {"data": "..."}
  if (body && typeof body.data === 'string') {
    try {
      body = JSON.parse(body.data);
    } catch (e) {}
  }

  // Extract all potential fields
  const type = (req.query.type || body.type || req.query.request || body.request || '').toLowerCase();
  const username = body.username || req.query.username || '';
  const password = body.password || req.query.password || body.pass || req.query.pass || '';
  const token = body.token || req.query.token || '';
  const key = body.key || req.query.key || '';
  const hwid = body.hwid || req.query.hwid || '';
  const sessionid = body.sessionid || req.query.sessionid || '';

  // --- Handshake 1: KeyAuth Init Request ---
  if (type === 'init') {
    return res.status(200).json({
      success: true,
      status: 'success',
      message: 'Initialized',
      sessionid: 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36),
      appinfo: {
        numUsers: '1337',
        numOnlineUsers: '42',
        numKeys: '999',
        version: '3.0',
        customerPanel: 'https://auth1233123213.netlify.app'
      }
    });
  }

  // --- Handshake 2: Heartbeat / Ping / Check ---
  if (type === 'check' || type === 'ping' || type === 'checkblacklist') {
    return res.status(200).json({
      success: true,
      status: 'success',
      message: 'OK'
    });
  }

  // --- Handshake 3: Login / License Auth ---
  // Candidate key could be passed as: key, password, token, or username
  const candidateKey = key || password || token || username;

  if (!candidateKey) {
    return res.status(200).json({
      success: false,
      status: 'error',
      message: 'Chave de acesso nao informada (Key not provided)',
      mensagem: 'Chave de acesso nao informada (Key not provided)'
    });
  }

  const result = db.validateKey(candidateKey, hwid);

  if (!result.valid) {
    return res.status(200).json({
      success: false,
      status: 'error',
      message: result.error || 'Autenticacao rejeitada.',
      mensagem: result.error || 'Autenticacao rejeitada.'
    });
  }

  const keyData = result.key;
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = keyData.expiresAt ? Math.floor(keyData.expiresAt / 1000) : 1792504432;
  const timeLeft = keyData.expiresAt ? Math.max(0, expSec - nowSec) : 999999999;
  const expireStr = keyData.expiresAt 
    ? new Date(keyData.expiresAt).toISOString().replace('T', ' ').substring(0, 19)
    : 'LIFETIME (Sem expiracao)';

  // Hybrid response containing ALL fields expected by BR.Mods and KeyAuth C++ SDK
  return res.status(200).json({
    // Standard KeyAuth fields
    success: true,
    message: 'Autenticado com sucesso! BR.Mods VIP',
    sessionid: sessionid || ('sess_' + Math.random().toString(36).substring(2)),
    info: {
      username: username || candidateKey,
      subscriptions: [
        {
          subscription: 'default',
          key: keyData.key,
          expiry: expSec.toString(),
          timeleft: timeLeft
        }
      ],
      ip: req.ip || '127.0.0.1',
      hwid: hwid || 'HWID_LOCKED',
      createdate: Math.floor(keyData.createdAt / 1000).toString(),
      lastlogin: nowSec.toString()
    },

    // BR.Mods custom fields
    status: 'success',
    mensagem: 'Autenticado com sucesso! BR.Mods VIP',
    token: keyData.key,
    timeData: nowSec.toString(),
    expire: expireStr
  });
}

// Map all potential endpoints to the universal auth handler
const AUTH_ROUTES = [
  '/auth/auth.php',
  '/auth.php',
  '/api/auth/login',
  '/api/1.0/',
  '/api/1.1/',
  '/api/1.2/',
  '/api/v1/',
  '/1.2/'
];

app.all(AUTH_ROUTES, handleAuthRequest);

// -------------------------------------------------------------
// KEY MANAGEMENT API (Cho Web Panel)
// -------------------------------------------------------------
app.get('/api/keys', (req, res) => {
  res.json({ status: 'success', keys: db.listKeys() });
});

app.post('/api/keys', (req, res) => {
  const { durationHours = 24, note = '', customKey = '' } = req.body;
  const keyStr = customKey.trim() || ('VIP-' + Math.random().toString(36).substring(2, 7).toUpperCase() + '-' + Math.random().toString(36).substring(2, 7).toUpperCase());

  const created = db.createKey({
    key: keyStr,
    durationHours: parseInt(durationHours, 10),
    note,
    createdBy: 'web_panel'
  });

  res.json({ status: 'success', key: created });
});

app.delete('/api/keys/:key', (req, res) => {
  const ok = db.deleteKey(req.params.key);
  res.json({ status: ok ? 'success' : 'error' });
});

app.post('/api/keys/:key/reset-hwid', (req, res) => {
  const ok = db.resetHwid(req.params.key);
  res.json({ status: ok ? 'success' : 'error' });
});

// Fallback for root POST requests (Some KeyAuth versions post directly to /)
app.post('/', (req, res, next) => {
  if (req.body && (req.body.type || req.body.key || req.body.username || req.body.data)) {
    return handleAuthRequest(req, res);
  }
  next();
});

// Start local server
if (process.env.NODE_ENV !== 'production' || !process.env.NETLIFY) {
  app.listen(PORT, () => {
    console.log(`[BR.MODS KEY SERVER] Dang chay tai: http://localhost:${PORT}`);
  });
}

module.exports = app;
