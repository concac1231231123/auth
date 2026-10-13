const fs = require('fs');
const path = require('path');

// Local storage directory
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// In-memory cache / state with default master VIP keys (persist across serverless cold starts)
let state = {
  keys: {
    'BRMODS-OWNER-VIP': {
      key: 'BRMODS-OWNER-VIP',
      durationHours: -1,
      createdAt: 1700000000000,
      expiresAt: null,
      hwid: null,
      maxDevices: 99,
      note: 'Master Owner VIP Key (Vinh vien)',
      createdBy: 'owner',
      active: true
    },
    'VIP-LIFETIME': {
      key: 'VIP-LIFETIME',
      durationHours: -1,
      createdAt: 1700000000000,
      expiresAt: null,
      hwid: null,
      maxDevices: 99,
      note: 'Master Lifetime VIP Key (Vinh vien)',
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
  createKey({ key, durationHours = 24, note = '', createdBy = 'owner', maxDevices = 1 }) {
    const now = Date.now();
    const expiresAt = durationHours === -1 ? null : now + durationHours * 3600 * 1000;
    
    state.keys[key] = {
      key,
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
    return state.keys[key];
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

  validateKey(key, hwid) {
    const k = this.getKey(key);
    if (!k) return { valid: false, error: 'Chave nao encontrada (Key not found)' };
    if (!k.active) return { valid: false, error: 'Chave desativada (Key disabled)' };

    const now = Date.now();
    if (k.expiresAt && now > k.expiresAt) {
      return { valid: false, error: 'Chave expirada (Key expired)' };
    }

    // HWID Binding
    if (!k.hwid && hwid) {
      k.hwid = hwid;
      saveLocalDb();
    } else if (k.hwid && hwid && k.hwid !== hwid) {
      return { valid: false, error: 'HWID nao coincide (HWID mismatch)' };
    }

    return { valid: true, key: k };
  }
};

module.exports = db;
