import React, { useState } from 'react';
import { useNavigate, useOutletContext, Link } from 'react-router-dom';
import {
  Zap, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  MapPin, Sparkles, MessageSquare, Loader2, RefreshCw, ArrowRight,
  ShieldAlert, User, DollarSign, Home
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DecisionBadge, RiskTierBadge } from '../../components/ui/Badge';
import { Header } from '../../components/layout/Header';
import { cn, formatCurrency } from '../../lib/utils';
import { ordersApi } from '../../services/api';

// ── Circular Gauge ─────────────────────────────────────────────────────────
function CircularGauge({ score = 0, tier }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const tierColors = {
    LOW: '#12B76A',
    MEDIUM: '#F79009',
    HIGH: '#F04438',
    CRITICAL: '#991B1B',
  };
  const color = tierColors[tier] || '#635BFF';
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#F2F4F7" strokeWidth="12" />
        <motion.circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.0, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-extrabold font-mono"
          style={{ color }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          {score}
        </motion.span>
        <span className="text-[10px] text-secondary font-bold uppercase tracking-wider">Risk Score</span>
      </div>
    </div>
  );
}

// ── Skeleton Placeholder ───────────────────────────────────────────────────
function ResultsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex justify-center py-6">
        <div className="w-36 h-36 rounded-full bg-gray-100" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 rounded-xl" />
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export function RiskAnalysisPage() {
  const navigate = useNavigate();
  const { onToggleMobileMenu } = useOutletContext() || {};

  const [form, setForm] = useState({
    orderId: `ORD_${Date.now().toString().slice(-5)}`,
    orderValue: '649',
    paymentMethod: 'COD',
    shippingAddress: 'Flat 402, Sunshine Apts, Near WEH Metro Station',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400050',
    customerName: 'Priya Sharma',
    priorOrders: '1',
    priorRtos: '0',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const regenerateId = () =>
    setForm((f) => ({ ...f, orderId: `ORD_${Date.now().toString().slice(-5)}` }));

  // Quick preset loader for fast testing
  const loadPreset = (type) => {
    if (type === 'LOW_METRO') {
      setForm({
        orderId: `ORD_LOW_${Date.now().toString().slice(-4)}`,
        orderValue: '649',
        paymentMethod: 'COD',
        shippingAddress: 'Flat 402, Sunshine Apts, Near WEH Metro Station, Bandra West',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400050',
        customerName: 'Priya Sharma',
        priorOrders: '2',
        priorRtos: '0',
      });
    } else if (type === 'HIGH_FIRST_TIMER') {
      setForm({
        orderId: `ORD_HIGH_${Date.now().toString().slice(-4)}`,
        orderValue: '1299',
        paymentMethod: 'COD',
        shippingAddress: 'home near shop',
        city: 'Gorakhpur',
        state: 'Uttar Pradesh',
        pincode: '273001',
        customerName: 'asdf test',
        priorOrders: '0',
        priorRtos: '0',
      });
    } else if (type === 'REPEAT_OFFENDER') {
      setForm({
        orderId: `ORD_RTO_${Date.now().toString().slice(-4)}`,
        orderValue: '899',
        paymentMethod: 'COD',
        shippingAddress: 'Ward 3, Chowk Bazar',
        city: 'Bareilly',
        state: 'Uttar Pradesh',
        pincode: '243001',
        customerName: 'Amit Verma',
        priorOrders: '3',
        priorRtos: '2',
      });
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        orderId: form.orderId,
        customerName: form.customerName,
        orderValue: parseFloat(form.orderValue) || 649,
        paymentMethod: form.paymentMethod,
        shippingAddress: form.shippingAddress,
        shippingCity: form.city,
        shippingState: form.state,
        shippingPincode: form.pincode,
        customerPriorOrders: parseInt(form.priorOrders) || 0,
        customerPriorRto: parseInt(form.priorRtos) || 0,
      };
      const res = await ordersApi.createTestOrder(payload);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Analysis failed. Please check your backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full text-xs rounded-lg border border-neutralBorder px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-accent/30 transition-all';
  const labelCls = 'text-xs font-semibold text-secondary block mb-1';

  // Extract results safely from any format
  const resData = result?.data || result;
  const prediction = result?.aiPrediction || result?.riskAssessment || resData?.riskAssessment || resData?.aiPrediction;
  const decision = result?.decisionAnalysis || resData?.decisionAnalysis || resData?.operationalDecision;
  const address = result?.addressValidation || resData?.addressValidation || prediction?.address_validation;
  const financial = result?.financialImpact || resData?.financialImpact || decision?.financialImpact;

  const score = prediction?.risk_score ?? prediction?.riskScore ?? prediction?.score ?? 0;
  const tier = prediction?.risk_tier ?? prediction?.riskTier ?? prediction?.tier ?? 'LOW';
  const decisionVal = decision?.decision ?? prediction?.decision ?? 'SHIP_AS_IS';
  const decisionReason = decision?.reason ?? prediction?.decision_reason ?? '';

  const rawFactors = prediction?.risk_factors || prediction?.riskFactors || [];
  const increasing = rawFactors.filter((f) => f.impact === 'RISK_INCREASING');
  const decreasing = rawFactors.filter((f) => f.impact === 'RISK_DECREASING');

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Header
        title="AI Risk & Address Workspace"
        subtitle="Analyze any custom order in real-time with full explainability and financial reasoning."
        onToggleMobileMenu={onToggleMobileMenu}
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* Preset quick buttons */}
        <div className="mb-6 p-4 bg-white rounded-xl border border-neutralBorder flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-secondary">
            <Sparkles className="w-4 h-4 text-primary-accent" />
            <span>Load Quick Simulation Presets:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadPreset('LOW_METRO')}
              className="px-3 py-1 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              ✓ Low Risk (Mumbai Metro)
            </button>
            <button
              type="button"
              onClick={() => loadPreset('HIGH_FIRST_TIMER')}
              className="px-3 py-1 text-xs font-medium rounded-lg bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              ⚠ High Risk (First-Timer + Vague Address)
            </button>
            <button
              type="button"
              onClick={() => loadPreset('REPEAT_OFFENDER')}
              className="px-3 py-1 text-xs font-medium rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
            >
              ✕ Chronic Repeat RTO Offender (2x RTO)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* ── LEFT: Input Form ── */}
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary-accent" /> Order Parameters
                  </CardTitle>
                  <CardDescription>Enter order signals known at checkout to run the AI engine</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAnalyze} className="space-y-4">
                  {/* Order ID */}
                  <div>
                    <label className={labelCls}>Order ID</label>
                    <div className="flex gap-2">
                      <input className={inputCls} value={form.orderId} onChange={set('orderId')} />
                      <Button type="button" variant="outline" size="sm" onClick={regenerateId} className="shrink-0" title="Regenerate unique ID">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Customer Name</label>
                      <input required className={inputCls} value={form.customerName} onChange={set('customerName')} />
                    </div>
                    <div>
                      <label className={labelCls}>Order Value (₹)</label>
                      <input required type="number" className={inputCls} value={form.orderValue} onChange={set('orderValue')} />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Payment Method</label>
                    <div className="flex gap-4">
                      {['COD', 'PREPAID'].map((pm) => (
                        <label key={pm} className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value={pm}
                            checked={form.paymentMethod === pm}
                            onChange={set('paymentMethod')}
                            className="accent-primary-accent"
                          />
                          <span>{pm}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Full Delivery Address</label>
                    <textarea
                      required
                      rows={2}
                      className={inputCls}
                      value={form.shippingAddress}
                      onChange={set('shippingAddress')}
                      placeholder="e.g. Flat 402, Sunshine Apts, Near WEH Metro Station"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>City</label>
                      <input required className={inputCls} value={form.city} onChange={set('city')} />
                    </div>
                    <div>
                      <label className={labelCls}>State</label>
                      <input required className={inputCls} value={form.state} onChange={set('state')} />
                    </div>
                    <div>
                      <label className={labelCls}>Pincode</label>
                      <input required className={inputCls} value={form.pincode} onChange={set('pincode')} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Prior Orders</label>
                      <input type="number" min="0" className={inputCls} value={form.priorOrders} onChange={set('priorOrders')} />
                    </div>
                    <div>
                      <label className={labelCls}>Prior RTOs</label>
                      <input type="number" min="0" className={inputCls} value={form.priorRtos} onChange={set('priorRtos')} />
                    </div>
                  </div>

                  <Button type="submit" variant="primary" size="lg" isLoading={loading} className="w-full mt-2 gap-2">
                    {!loading && <Zap className="w-4 h-4" />}
                    Analyze & Score Order
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT: Results ── */}
          <div className="space-y-5">
            {!result && !loading && !error && (
              <Card className="p-8 text-center border-dashed">
                <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                  <Sparkles className="w-8 h-8 text-primary-accent" />
                </div>
                <h3 className="text-base font-bold text-primary mb-1">Ready for Real-Time Analysis</h3>
                <p className="text-xs text-secondary max-w-sm mx-auto leading-relaxed">
                  Fill in the order details or choose a Quick Simulation Preset on the left, then click <strong>"Analyze & Score Order"</strong>.
                </p>
              </Card>
            )}

            {loading && (
              <Card>
                <CardContent className="p-6">
                  <ResultsSkeleton />
                </CardContent>
              </Card>
            )}

            {error && (
              <Card className="border-rose-200 bg-rose-50/40">
                <CardContent className="flex items-center gap-3 py-4">
                  <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-rose-700">Analysis Failed</p>
                    <p className="text-xs text-rose-600">{error}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <AnimatePresence>
              {result && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-5"
                >
                  {/* Gauge & Canonical Decision Card */}
                  <Card className="overflow-hidden bg-gradient-to-b from-white to-gray-50/50">
                    <CardContent className="p-6">
                      <div className="flex flex-col items-center gap-4 text-center">
                        <CircularGauge score={score} tier={tier} />
                        <RiskTierBadge tier={tier} score={score} className="text-xs px-3 py-1 font-bold" />
                        <div>
                          <DecisionBadge decision={decisionVal} className="text-sm px-4 py-2" />
                          {decisionReason && (
                            <p className="text-xs text-secondary mt-2.5 max-w-sm mx-auto leading-relaxed">
                              {decisionReason}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Direct shortcut to WhatsApp Simulator */}
                      <div className="mt-6 pt-4 border-t border-neutralBorder text-center">
                        <Link to={`/whatsapp-simulator?orderId=${form.orderId}`}>
                          <Button variant="secondary" size="sm" className="w-full gap-2">
                            <MessageSquare className="w-4 h-4 text-[#128C7E]" />
                            Test this order in WhatsApp Simulator
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Financial Payoff Breakdown */}
                  {financial && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-xs uppercase tracking-wider font-bold">
                          Unit Economics Payoff
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="divide-y divide-neutralBorder/60 text-xs">
                          {Object.entries(financial).map(([key, val]) => (
                            <div key={key} className="flex justify-between items-center py-2.5">
                              <span className="text-secondary">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                              <span className="font-mono font-semibold text-primary">
                                {typeof val === 'number' ? formatCurrency(val) : val}
                              </span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Address Intelligence */}
                  {address && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-xs uppercase tracking-wider font-bold flex items-center justify-between w-full">
                          <span>Address Deliverability Analysis</span>
                          <span className="text-[10px] font-semibold text-primary-accent bg-indigo-50 px-2 py-0.5 rounded-full">
                            {address.validationSource || address.validation_source || 'AI Verified'}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-secondary">Quality Score:</span>
                          <span className="font-mono font-bold text-sm text-primary">
                            {address.qualityScore ?? address.quality_score ?? 80}/100
                          </span>
                        </div>
                        <div className="text-xs bg-gray-50 p-2.5 rounded-lg border border-neutralBorder">
                          {form.shippingAddress}, {form.city} - {form.pincode}
                        </div>
                        {address.issues?.length > 0 ? (
                          <div className="space-y-1 pt-1 text-xs text-amber-700">
                            {address.issues.map((iss, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>{iss}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Address is complete with street details and recognizable landmark.</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Risk Factors Breakdown */}
                  {rawFactors.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-xs uppercase tracking-wider font-bold">
                          Key Risk Factors & Explanations
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-4">
                        {increasing.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 uppercase">
                              <TrendingUp className="w-3.5 h-3.5" /> Risk Increasing
                            </div>
                            {increasing.map((f, i) => (
                              <div key={i} className="p-2.5 rounded-xl bg-rose-50/60 border border-rose-100 text-xs">
                                <div className="font-semibold text-rose-800">{f.featureName || f.feature}</div>
                                {f.description && <p className="text-rose-600 mt-0.5">{f.description}</p>}
                              </div>
                            ))}
                          </div>
                        )}

                        {decreasing.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 uppercase">
                              <TrendingDown className="w-3.5 h-3.5" /> Risk Decreasing
                            </div>
                            {decreasing.map((f, i) => (
                              <div key={i} className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs">
                                <div className="font-semibold text-emerald-800">{f.featureName || f.feature}</div>
                                {f.description && <p className="text-emerald-600 mt-0.5">{f.description}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
