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
// 1. CLIENT AUTH ENDPOINT (Protocol chuẩn của minduin.dll)
// -------------------------------------------------------------
app.all(['/auth/auth.php', '/api/auth/login'], (req, res) => {
  let body = req.body || {};

  if (body && typeof body.data === 'string') {
    try {
      body = JSON.parse(body.data);
    } catch (e) {}
  }

  const username = body.username || req.query.username || '';
  const password = body.password || req.query.password || '';
  const token = body.token || req.query.token || '';
  const hwid = body.hwid || req.query.hwid || '';

  const candidateKey = password || token || username;

  if (!candidateKey) {
    return res.status(200).json({
      status: 'error',
      mensagem: 'Chave de acesso nao informada (Key not provided)'
    });
  }

  const result = db.validateKey(candidateKey, hwid);

  if (!result.valid) {
    return res.status(200).json({
      status: 'error',
      mensagem: result.error || 'Autenticacao rejeitada.'
    });
  }

  const keyData = result.key;
  const expireStr = keyData.expiresAt 
    ? new Date(keyData.expiresAt).toISOString().replace('T', ' ').substring(0, 19)
    : 'LIFETIME (Sem expiracao)';

  return res.status(200).json({
    status: 'success',
    mensagem: 'Autenticado com sucesso! BR.Mods VIP',
    token: keyData.key,
    timeData: Math.floor(Date.now() / 1000).toString(),
    expire: expireStr
  });
});

// -------------------------------------------------------------
// 2. KEY MANAGEMENT API (Trực tiếp, nhanh gọn cho Đại ca)
// -------------------------------------------------------------

// Lấy danh sách key
app.get('/api/keys', (req, res) => {
  res.json({ status: 'success', keys: db.listKeys() });
});

// Tạo key mới
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

// Xóa key
app.delete('/api/keys/:key', (req, res) => {
  const ok = db.deleteKey(req.params.key);
  res.json({ status: ok ? 'success' : 'error' });
});

// Reset HWID
app.post('/api/keys/:key/reset-hwid', (req, res) => {
  const ok = db.resetHwid(req.params.key);
  res.json({ status: ok ? 'success' : 'error' });
});

// Chạy server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`[BR.MODS KEY SERVER] Dang chay tai: http://localhost:${PORT}`);
  console.log(`[AUTH ENDPOINT] POST http://localhost:${PORT}/auth/auth.php?request=login`);
  console.log(`====================================================`);
});

module.exports = app;
