const fs = require('fs');
const path = require('path');

// Local storage directory
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// In-memory cache / state with default master VIP accounts (persist across serverless cold starts)
let state = {
  keys: {
    'BRMODS-OWNER-VIP': {
      key: 'BRMODS-OWNER-VIP',
      username: 'admin',
      password: 'BRMODS-OWNER-VIP',
      durationHours: -1,
      createdAt: 1700000000000,
      expiresAt: null,
      hwid: null,
      maxDevices: 99,
      note: 'Master Owner VIP (Vinh vien)',
      createdBy: 'owner',
      active: true
    },
    'VIP-LIFETIME': {
      key: 'VIP-LIFETIME',
      username: 'vip',
      password: 'VIP-LIFETIME',
      durationHours: -1,
      createdAt: 1700000000000,
      expiresAt: null,
      hwid: null,
      maxDevices: 99,
      note: 'Master Lifetime VIP',
      createdBy: 'owner',
      active: true
    }
  },
  sessions: {},
  settings: {
    getLinkProvider: 'internal',
    defaultKeyHours: 24,
    adminSecret: process.env.ADMIN_SECRET || 'owner_secret_123456'
  }
};

// Initialize local DB file if exists
function initLocalDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      state.keys = { ...state.keys, ...parsed.keys };
      state.settings = { ...state.settings, ...parsed.settings };
    } else {
      saveLocalDb();
    }
  } catch (err) {
    console.error('[DB] Local init warning:', err.message);
  }
}

function saveLocalDb() {
  try {
    if (fs.existsSync(DATA_DIR)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
    }
  } catch (err) {}
}

initLocalDb();

const db = {
  // Tạo Key hoặc Cặp Tài khoản User/Pass
  createKey({ key = '', username = '', password = '', durationHours = 24, note = '', createdBy = 'owner', maxDevices = 1 }) {
    const now = Date.now();
    const expiresAt = durationHours === -1 ? null : now + durationHours * 3600 * 1000;
    
    // Khóa định danh
    const keyId = (key || password || username || ('VIP-' + Math.random().toString(36).substring(2, 7).toUpperCase())).trim();
    const userVal = (username || keyId).trim();
    const passVal = (password || keyId).trim();

    state.keys[keyId] = {
      key: keyId,
      username: userVal,
      password: passVal,
      durationHours,
      createdAt: now,
      expiresAt,
      hwid: null,
      maxDevices,
      note,
      createdBy,
      active: true
    };
    saveLocalDb();
    return state.keys[keyId];
  },

  getKey(key) {
    if (!key || !state.keys[key]) return null;
    return state.keys[key];
  },

  listKeys() {
    return Object.values(state.keys);
  },

  deleteKey(key) {
    if (state.keys[key]) {
      delete state.keys[key];
      saveLocalDb();
      return true;
    }
    return false;
  },

  resetHwid(key) {
    if (state.keys[key]) {
      state.keys[key].hwid = null;
      saveLocalDb();
      return true;
    }
    return false;
  },

  toggleKey(key, active) {
    if (state.keys[key]) {
      state.keys[key].active = active;
      saveLocalDb();
      return true;
    }
    return false;
  },

  // Xác thực linh hoạt: hỗ trợ cả User/Pass và Key
  validateAccount({ username = '', password = '', token = '', key = '', hwid = '' }) {
    const u = (username || '').trim();
    const p = (password || '').trim();
    const t = (token || '').trim();
    const k = (key || '').trim();

    let matched = null;

    // 1. Kiểm tra cặp User & Pass chuẩn
    if (u && p) {
      matched = Object.values(state.keys).find(item => 
        item.username && item.username.toLowerCase() === u.toLowerCase() && item.password === p
      );
    }

    // 2. Kiểm tra nếu Pass trùng với một Key hợp lệ
    if (!matched && p) {
      matched = state.keys[p] || Object.values(state.keys).find(item => item.key === p || item.password === p);
    }

    // 3. Kiểm tra nếu Token trùng với một Key
    if (!matched && t) {
      matched = state.keys[t] || Object.values(state.keys).find(item => item.key === t || item.password === t);
    }

    // 4. Kiểm tra nếu trường Key trùng
    if (!matched && k) {
      matched = state.keys[k] || Object.values(state.keys).find(item => item.key === k || item.password === k);
    }

    // 5. Kiểm tra nếu User trùng với một Key (trường hợp khách dán Key vào ô User)
    if (!matched && u) {
      matched = state.keys[u] || Object.values(state.keys).find(item => item.key === u);
    }

    if (!matched) {
      return { valid: false, error: 'Chave/Usuario nao encontrado (Key/User not found)' };
    }

    if (!matched.active) {
      return { valid: false, error: 'Conta desativada (Account disabled)' };
    }

    const now = Date.now();
    if (matched.expiresAt && now > matched.expiresAt) {
      return { valid: false, error: 'Chave expirada (Key/Account expired)' };
    }

    // HWID Binding
    if (matched.maxDevices && matched.maxDevices > 1) {
      // Tài khoản đa thiết bị / Master VIP: Không khóa cứng HWID đơn lẻ
    } else if (hwid) {
      if (!matched.hwid) {
        matched.hwid = hwid;
        saveLocalDb();
      } else if (matched.hwid !== hwid) {
        return { valid: false, error: 'HWID nao coincide (HWID mismatch)' };
      }
    }

    return { 
      valid: true, 
      key: matched, 
      displayUser: u || matched.username || matched.key 
    };
  },

  // Giữ lại validateKey cũ cho tương thích
  validateKey(key, hwid) {
    return this.validateAccount({ password: key, hwid });
  }
};

module.exports = db;
