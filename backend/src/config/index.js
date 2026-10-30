import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  jwtSecret: process.env.JWT_SECRET || 'rto-sentinel-dev-secret-key-391823',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/rto_sentinel',
  aiEngineUrl: process.env.AI_ENGINE_URL || 'http://127.0.0.1:8000/api/v1',
  
  // Business Unit Economics
  economics: {
    aov: 649,
    grossMarginPct: 0.62,
    forwardShipping: 65,
    returnShipping: 65,
    packagingHandling: 25,
    damageProbability: 0.08,
    avgProductCost: 180,
    cacNewCustomer: 300,
    whatsAppCostPerMsg: 0.50,
    prepaidDiscount: 20,
    prepaidConversionRate: 0.25,
    prepaidRtoRate: 0.04
  },

  // Derived constants
  get expectedRtoCost() {
    return (
      this.economics.forwardShipping +
      this.economics.returnShipping +
      this.economics.packagingHandling +
      (this.economics.damageProbability * this.economics.avgProductCost)
    ); // ₹169.40
  },
  
  get deliveredGrossProfit() {
    return this.economics.aov * this.economics.grossMarginPct; // ₹402.38
  }
};

