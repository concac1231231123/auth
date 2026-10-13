const fs = require('fs');
const path = require('path');

// Local storage directory
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// In-memory cache / state
let state = {
  keys: {},       // key -> { key, durationHours, createdAt, expiresAt, hwid, maxDevices, note, createdBy, active }
  sessions: {},   // sessionId -> { id, ip, createdAt, expiresAt, completedSteps, maxSteps, rewardDurationHours, keyGenerated }
  settings: {
    getLinkProvider: 'internal', // 'internal', 'lootlabs', 'linkvertise'
    linkvertiseUrl: '',
    lootlabsUrl: '',
    internalSteps: 2,
    defaultKeyHours: 24,
    adminSecret: process.env.ADMIN_SECRET || 'owner_secret_123456'
  }
};

// Initialize local DB file if not exists
function initLocalDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      state = { ...state, ...JSON.parse(raw) };
    } else {
      saveLocalDb();
    }
  } catch (err) {
    console.error('[DB] Local init warning (read-only environment or first run):', err.message);
  }
}

function saveLocalDb() {
  try {
    if (fs.existsSync(DATA_DIR)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), 'utf8');
    }
  } catch (err) {
    // If in ephemeral serverless environment without write permissions
  }
}

initLocalDb();

// Database operations
const db = {
  // --- Key operations ---
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

  // Validate and bind HWID
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
  },

  // --- Get-Link Sessions ---
  createSession(ip, rewardDurationHours = 24) {
    const id = 'sess_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const session = {
      id,
      ip,
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 60 * 1000, // 30 mins to complete
      completedSteps: 0,
      maxSteps: state.settings.internalSteps || 2,
      rewardDurationHours,
      keyGenerated: null
    };
    state.sessions[id] = session;
    saveLocalDb();
    return session;
  },

  getSession(id) {
    return state.sessions[id] || null;
  },

  advanceStep(id) {
    const session = state.sessions[id];
    if (!session) return null;
    if (Date.now() > session.expiresAt) return null;

    session.completedSteps += 1;
    if (session.completedSteps >= session.maxSteps && !session.keyGenerated) {
      // Auto generate key
      const keyStr = 'BRMODS-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      this.createKey({
        key: keyStr,
        durationHours: session.rewardDurationHours,
        note: `Get-Link session ${id}`,
        createdBy: 'get-link'
      });
      session.keyGenerated = keyStr;
    }
    saveLocalDb();
    return session;
  },

  // --- Settings ---
  getSettings() {
    return state.settings;
  },

  updateSettings(newSettings) {
    state.settings = { ...state.settings, ...newSettings };
    saveLocalDb();
    return state.settings;
  }
};

module.exports = db;
