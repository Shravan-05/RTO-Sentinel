import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../../data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

const findCsvPath = () => {
  const candidates = [
    path.resolve(process.cwd(), 'orders_sample.csv'),
    path.resolve(__dirname, '../../../orders_sample.csv'),
    path.resolve(__dirname, '../../../fastapi/data/raw/orders_sample.csv'),
    path.resolve(process.cwd(), 'fastapi/data/raw/orders_sample.csv'),
    path.resolve(__dirname, '../../../../orders_sample.csv')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
};

const CSV_FILE = findCsvPath();

class StorageEngine {
  constructor() {
    this.mode = 'MEMORY'; // 'MONGO' | 'MEMORY'
    this.db = {
      users: [],
      orders: [],
      decisions: [],
      conversations: [],
      settings: {}
    };
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Attempt MongoDB Connection
    try {
      await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 2000 });
      this.mode = 'MONGO';
      logger.info(`Connected to MongoDB successfully at ${config.mongoUri}`);
    } catch (err) {
      this.mode = 'MEMORY';
      logger.warn(`MongoDB not available (${err.message}). Using local JSON/In-Memory storage engine.`);
      this._loadFromFile();
    }

    // Seed data if empty
    if (this.db.orders.length === 0) {
      await this.seedInitialData();
    }

    this.initialized = true;
  }

  _loadFromFile() {
    if (fs.existsSync(STORE_FILE)) {
      try {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        this.db = JSON.parse(raw);
        logger.info(`Loaded ${this.db.orders?.length || 0} orders from persistent store.`);
      } catch (e) {
        logger.error(`Error loading store.json: ${e.message}`);
      }
    }
  }

  _persist() {
    if (this.mode === 'MEMORY') {
      try {
        fs.writeFileSync(STORE_FILE, JSON.stringify(this.db, null, 2), 'utf-8');
      } catch (e) {
        logger.error(`Failed to persist store.json: ${e.message}`);
      }
    }
  }

  async seedInitialData() {
    logger.info('Initializing seed dataset for RTO Sentinel...');
    
    // Seed default admin user
    this.db.users = [{
      id: 'usr_admin_1',
      name: 'Aditya Mehta',
      email: 'admin@rtosentinel.com',
      password: 'admin123', // In demo/take-home assignment, clear admin credentials
      role: 'ADMIN',
      brand: 'VelvetLocks Haircare',
      createdAt: new Date().toISOString()
    }];

    // Seed default settings
    this.db.settings = {
      thresholds: {
        lowMax: 29,
        mediumMax: 54,
        highMax: 74
      },
      policies: {
        lowAction: 'SHIP_AS_IS',
        mediumAction: 'SHIP_AFTER_CONFIRMATION',
        highAction: 'NUDGE_TO_PREPAID',
        criticalAction: 'HOLD_CANCEL'
      },
      nudgeDiscountAmount: 20,
      autoCancelTimeoutHours: 24,
      protectFirstTimeBuyers: true,
      economics: { ...config.economics }
    };

    // Load and seed orders from CSV
    if (fs.existsSync(CSV_FILE)) {
      try {
        const content = fs.readFileSync(CSV_FILE, 'utf-8');
        const lines = content.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        const orders = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          if (!line.trim()) continue;

          // Simple CSV line parser handling commas inside quotes
          const values = [];
          let insideQuotes = false;
          let currentVal = '';
          for (let c = 0; c < line.length; c++) {
            const char = line[c];
            if (char === '"') {
              insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
              values.push(currentVal.trim());
              currentVal = '';
            } else {
              currentVal += char;
            }
          }
          values.push(currentVal.trim());

          const row = {};
          headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
          });

          // Derive synthetic operational decision & risk scoring based on features
          const priorRto = parseInt(row.customer_prior_rto || '0', 10);
          const priorOrders = parseInt(row.customer_prior_orders || '0', 10);
          const isCod = (row.payment_method || '').toUpperCase() === 'COD';
          const orderVal = parseFloat(row.order_value || '649');
          const finalStatus = (row.final_status || '').trim().toUpperCase();

          // Rule simulation
          let riskScore = 18;
          let decision = 'SHIP_AS_IS';
          let riskTier = 'LOW';

          if (!isCod) {
            riskScore = 8;
            decision = 'SHIP_AS_IS';
            riskTier = 'LOW';
          } else if (priorRto >= 2) {
            riskScore = 85;
            decision = 'HOLD_CANCEL';
            riskTier = 'CRITICAL';
          } else if (priorRto === 1) {
            riskScore = 65;
            decision = 'NUDGE_TO_PREPAID';
            riskTier = 'HIGH';
          } else if (['Gorakhpur', 'Bareilly', 'Darbhanga', 'Sagar', 'Patna'].includes(row.city)) {
            riskScore = 58;
            decision = priorOrders === 0 ? 'SHIP_AFTER_CONFIRMATION' : 'NUDGE_TO_PREPAID';
            riskTier = 'HIGH';
          } else if (row.address.length < 12 || row.customer_name.toLowerCase() === 'test') {
            riskScore = 48;
            decision = 'SHIP_AFTER_CONFIRMATION';
            riskTier = 'MEDIUM';
          } else if (orderVal > 1500) {
            riskScore = 42;
            decision = 'SHIP_AFTER_CONFIRMATION';
            riskTier = 'MEDIUM';
          }

          orders.push({
            id: row.order_id,
            orderId: row.order_id,
            orderValue: orderVal,
            numItems: parseInt(row.num_items || '1', 10),
            paymentMethod: row.payment_method,
            finalStatus: finalStatus,
            customer: {
              name: row.customer_name,
              phone: `+91 98${Math.floor(10000000 + Math.random() * 90000000)}`,
              email: `${row.customer_name.toLowerCase().replace(/\s+/g, '') || 'user'}@gmail.com`,
              priorOrders,
              priorRto
            },
            shipping: {
              address: row.address,
              city: row.city,
              state: row.state,
              pincode: row.pincode
            },
            utmSource: row.utm_source || 'direct',
            orderDatetime: row.order_datetime,
            riskAssessment: {
              riskScore,
              riskTier,
              rtoProbability: riskScore / 100,
              confidence: 0.88
            },
            operationalDecision: {
              decision,
              status: decision === 'SHIP_AS_IS' ? 'DISPATCHED' : decision === 'HOLD_CANCEL' ? 'HELD' : 'PENDING_CONFIRMATION',
              reason: `Automated rule evaluation based on predicted risk (${riskScore}/100) and history.`,
              decidedAt: row.order_datetime,
              override: null
            },
            whatsapp: {
              status: decision === 'SHIP_AFTER_CONFIRMATION' ? 'CONFIRMED' : decision === 'NUDGE_TO_PREPAID' ? 'NUDGED' : 'NOT_REQUIRED',
              conversationId: null,
              lastMessageSentAt: null,
              confirmedAt: null
            }
          });
        }

        this.db.orders = orders;
        logger.info(`Seeded ${orders.length} orders successfully from ${CSV_FILE}`);
        this._persist();
      } catch (err) {
        logger.error(`Failed to parse orders CSV: ${err.message}`);
      }
    }
  }

  // Generic DB Operations
  async findOrders(query = {}) {
    let list = [...this.db.orders];

    if (query.search) {
      const q = String(query.search).trim().toLowerCase();
      list = list.filter(o => 
        (o.orderId && String(o.orderId).toLowerCase().includes(q)) ||
        (o.customer?.name && String(o.customer.name).toLowerCase().includes(q)) ||
        (o.shipping?.city && String(o.shipping.city).toLowerCase().includes(q)) ||
        (o.shipping?.pincode && String(o.shipping.pincode).includes(q))
      );
    }

    if (query.decision && query.decision !== 'ALL') {
      list = list.filter(o => o.operationalDecision?.decision === query.decision);
    }

    if (query.riskTier && query.riskTier !== 'ALL') {
      list = list.filter(o => o.riskAssessment?.riskTier === query.riskTier);
    }

    if (query.paymentMethod && query.paymentMethod !== 'ALL') {
      list = list.filter(o => o.paymentMethod && String(o.paymentMethod).toUpperCase() === query.paymentMethod.toUpperCase());
    }

    if (query.finalStatus && query.finalStatus !== 'ALL') {
      list = list.filter(o => o.finalStatus === query.finalStatus);
    }

    const total = list.length;
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;
    
    // Sort descending by date
    list.sort((a, b) => new Date(b.orderDatetime) - new Date(a.orderDatetime));
    
    const paginated = list.slice(skip, skip + limit);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      orders: paginated
    };
  }

  async findOrderById(orderId) {
    return this.db.orders.find(o => o.orderId === orderId || o.id === orderId);
  }

  async createOrder(orderData) {
    const newOrder = {
      id: orderData.orderId || `ORD_${Date.now()}`,
      orderId: orderData.orderId || `ORD_${Date.now()}`,
      ...orderData,
      orderDatetime: orderData.orderDatetime || new Date().toISOString()
    };
    this.db.orders.unshift(newOrder);
    this._persist();
    return newOrder;
  }

  async updateOrder(orderId, updateData) {
    const idx = this.db.orders.findIndex(o => o.orderId === orderId || o.id === orderId);
    if (idx === -1) return null;
    
    const target = this.db.orders[idx];
    for (const [key, value] of Object.entries(updateData)) {
      if (key.includes('.')) {
        const parts = key.split('.');
        let curr = target;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!curr[parts[i]]) curr[parts[i]] = {};
          curr = curr[parts[i]];
        }
        curr[parts[parts.length - 1]] = value;
      } else {
        target[key] = value;
      }
    }
    this._persist();
    return this.db.orders[idx];
  }

  async getSettings() {
    return this.db.settings;
  }

  async updateSettings(newSettings) {
    this.db.settings = { ...this.db.settings, ...newSettings };
    this._persist();
    return this.db.settings;
  }

  async findUserByEmail(email) {
    return this.db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  // WhatsApp Conversations
  async getConversationByOrderId(orderId) {
    return this.db.conversations.find(c => c.orderId === orderId);
  }

  async saveConversation(conv) {
    const idx = this.db.conversations.findIndex(c => c.orderId === conv.orderId);
    if (idx >= 0) {
      this.db.conversations[idx] = conv;
    } else {
      this.db.conversations.push(conv);
    }
    this._persist();
    return conv;
  }
}

export const storage = new StorageEngine();
