import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams, useOutletContext } from 'react-router-dom';
import {
  Search, Filter, Plus, Eye, MessageSquare, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, XCircle,
  ArrowUpDown, RotateCcw, Package, MapPin, DollarSign, User,
  ShieldAlert, Loader2, Info
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DecisionBadge, RiskTierBadge } from '../../components/ui/Badge';
import { Drawer } from '../../components/ui/Drawer';
import { Modal } from '../../components/ui/Modal';
import { Header } from '../../components/layout/Header';
import { cn, formatCurrency, formatDate } from '../../lib/utils';
import { ordersApi } from '../../services/api';

// ── Risk Score Bar ──────────────────────────────────────────────────────────
function RiskScoreBar({ score, tier }) {
  const tierColors = {
    LOW: 'bg-emerald-500',
    MEDIUM: 'bg-amber-500',
    HIGH: 'bg-orange-500',
    CRITICAL: 'bg-rose-500',
  };
  const color = tierColors[tier] || 'bg-gray-400';
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={cn('h-full rounded-full', color)}
        />
      </div>
      <span className="text-xs font-mono font-bold text-primary w-8 text-right">{score}</span>
    </div>
  );
}

// ── Drawer: Order Detail ────────────────────────────────────────────────────
function OrderDetailDrawer({ isOpen, onClose, orderId, onOverride }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [overrideDecision, setOverrideDecision] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverrideForm, setShowOverrideForm] = useState(false);

  useEffect(() => {
    if (isOpen && orderId) {
      setLoading(true);
      setOrder(null);
      ordersApi.getOrderById(orderId)
        .then(setOrder)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen, orderId]);

  const handleOverride = async () => {
    if (!overrideDecision) return;
    setOverriding(true);
    try {
      await ordersApi.overrideDecision(orderId, {
        decision: overrideDecision,
        newDecision: overrideDecision,
        reason: overrideReason,
      });
      setShowOverrideForm(false);
      if (onOverride) onOverride();
      // Refresh order
      const updated = await ordersApi.getOrderById(orderId);
      setOrder(updated);
    } catch (err) {
      console.error('Override failed:', err);
      alert('Override failed: ' + err.message);
    } finally {
      setOverriding(false);
    }
  };

  const impactIcon = (impact) => {
    if (impact === 'RISK_INCREASING') return <TrendingUp className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
    if (impact === 'RISK_DECREASING') return <TrendingDown className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
    return <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />;
  };

  const qScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-rose-600';
  };

  const riskFactors = order?.riskAssessment?.riskFactors || order?.aiPrediction?.risk_factors || [];
  const addressVal = order?.addressValidation || order?.aiPrediction?.address_validation;
  const financial = order?.financialImpact || order?.decisionAnalysis?.financialImpact;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={order ? `Order ${order.orderId}` : 'Order Details'}
      subtitle={order ? `${order.customer?.name} · ${formatDate(order.orderDatetime || order.createdAt)}` : 'Loading…'}
      width="max-w-2xl"
    >
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary-accent" />
        </div>
      )}

      {order && !loading && (
        <div className="space-y-6">
          {/* ── Order Metadata ── */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary mb-3">Order Metadata</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Order ID', value: order.orderId, mono: true },
                { label: 'Order Value', value: formatCurrency(order.orderValue), mono: true },
                { label: 'Payment Method', value: order.paymentMethod },
                { label: 'Status', value: order.operationalDecision?.status || 'PENDING' },
                { label: 'Customer', value: order.customer?.name },
                { label: 'Customer History', value: `${order.customer?.priorOrders ?? 0} orders / ${order.customer?.priorRto ?? 0} RTOs` },
                { label: 'Shipping City', value: `${order.shipping?.city}, ${order.shipping?.state}` },
                { label: 'Pincode', value: order.shipping?.pincode, mono: true },
              ].map(({ label, value, mono }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3 border border-neutralBorder/60">
                  <div className="text-[10px] uppercase font-semibold text-secondary tracking-wider">{label}</div>
                  <div className={cn('text-sm font-semibold text-primary mt-0.5 truncate', mono && 'font-mono')}>{value ?? '—'}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Canonical Decision ── */}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary mb-3">Operational Decision</h3>
            <div className="p-4 rounded-xl border border-neutralBorder bg-white shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <DecisionBadge decision={order.operationalDecision?.decision} className="text-sm px-3.5 py-1.5" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOverrideForm(!showOverrideForm)}
                  className="text-xs"
                >
                  {showOverrideForm ? 'Cancel' : 'Override Decision'}
                </Button>
              </div>
              {order.operationalDecision?.reason && (
                <p className="text-xs text-secondary mt-1 leading-relaxed">{order.operationalDecision.reason}</p>
              )}

              {showOverrideForm && (
                <div className="mt-4 pt-4 border-t border-neutralBorder space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-secondary block mb-1">Select New Operational Decision</label>
                    <select
                      value={overrideDecision}
                      onChange={(e) => setOverrideDecision(e.target.value)}
                      className="w-full text-xs font-semibold rounded-lg border border-neutralBorder px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-accent/30"
                    >
                      <option value="">Select decision…</option>
                      <option value="SHIP_AS_IS">Ship As-Is (Fast-track)</option>
                      <option value="SHIP_AFTER_CONFIRMATION">Ship After Confirmation (WhatsApp)</option>
                      <option value="NUDGE_TO_PREPAID">Nudge to Prepaid (₹20 Discount)</option>
                      <option value="HOLD_CANCEL">Hold / Cancel</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-secondary block mb-1">Reason for Override (Audit Log)</label>
                    <input
                      type="text"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="e.g. Verified genuine buyer by customer support call"
                      className="w-full text-xs rounded-lg border border-neutralBorder px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-accent/30"
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={overriding}
                    onClick={handleOverride}
                    disabled={!overrideDecision}
                    className="w-full"
                  >
                    Confirm & Persist Override
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* ── Risk Assessment ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-secondary">AI Risk Factors</h3>
              <RiskTierBadge tier={order.riskAssessment?.riskTier} score={order.riskAssessment?.riskScore} />
            </div>
            <div className="space-y-2">
              {riskFactors.length > 0 ? (
                riskFactors.map((factor, i) => (
                  <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl border border-neutralBorder bg-white">
                    <div className="mt-0.5">{impactIcon(factor.impact)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-primary truncate">{factor.featureName || factor.feature}</span>
                        <span className="text-[10px] font-mono text-secondary ml-2 shrink-0">
                          {factor.weight ? `w: ${factor.weight}` : ''}
                        </span>
                      </div>
                      {factor.description && (
                        <p className="text-xs text-secondary leading-relaxed">{factor.description}</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-secondary italic">Standard risk profile. No abnormal risk signals flagged.</p>
              )}
            </div>
          </section>

          {/* ── Address Validation ── */}
          {addressVal && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-secondary mb-3">Delivery Address Quality</h3>
              <div className="p-4 rounded-xl border border-neutralBorder bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-secondary">Quality Score</span>
                    <div className={cn('text-2xl font-bold font-mono', qScoreColor(addressVal.qualityScore ?? addressVal.quality_score ?? 80))}>
                      {addressVal.qualityScore ?? addressVal.quality_score ?? 80}<span className="text-xs text-secondary">/100</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-secondary">Category</span>
                    <div className="text-xs font-bold text-primary px-2 py-0.5 rounded bg-gray-100 mt-1 inline-block">
                      {addressVal.category || 'COMPLETE'}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-primary bg-gray-50 p-2.5 rounded-lg border border-neutralBorder/60">
                  {order.shipping?.address}
                </div>
                {addressVal.issues?.length > 0 && (
                  <div className="space-y-1 pt-1">
                    {addressVal.issues.map((issue, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-amber-700">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── Financial Impact ── */}
          {financial && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wider text-secondary mb-3">Unit Economics Payoff</h3>
              <div className="rounded-xl border border-neutralBorder bg-white overflow-hidden text-xs">
                {Object.entries(financial).map(([key, value], i, arr) => (
                  <div key={key} className={cn('flex items-center justify-between px-4 py-2.5', i < arr.length - 1 && 'border-b border-neutralBorder/60')}>
                    <span className="text-secondary">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    <span className="font-mono font-semibold text-primary">{typeof value === 'number' ? formatCurrency(value) : value}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* WhatsApp Simulator Shortcut */}
          <div className="pt-2">
            <Link to={`/whatsapp-simulator?orderId=${order.orderId}`} className="block">
              <Button variant="secondary" size="md" className="w-full gap-2">
                <MessageSquare className="w-4 h-4 text-[#128C7E]" /> Open in WhatsApp Simulator
              </Button>
            </Link>
          </div>
        </div>
      )}
    </Drawer>
  );
}

// ── Modal: New Test Order ───────────────────────────────────────────────────
function NewTestOrderModal({ isOpen, onClose, onCreated }) {
  const [form, setForm] = useState({
    customerName: '',
    orderValue: '649',
    paymentMethod: 'COD',
    address: '',
    city: '',
    state: '',
    pincode: '',
    priorOrders: '0',
    priorRtos: '0',
  });
  const [submitting, setSubmitting] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        customerName: form.customerName,
        orderValue: parseFloat(form.orderValue) || 649,
        paymentMethod: form.paymentMethod,
        shippingAddress: form.address,
        shippingCity: form.city,
        shippingState: form.state,
        shippingPincode: form.pincode,
        customerPriorOrders: parseInt(form.priorOrders) || 0,
        customerPriorRto: parseInt(form.priorRtos) || 0,
      };
      const res = await ordersApi.createTestOrder(payload);
      onClose();
      if (onCreated) onCreated(res?.data?.orderId || res?.orderId);
    } catch (err) {
      console.error('Failed to create test order:', err);
      alert('Failed to create order: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'w-full text-xs rounded-lg border border-neutralBorder px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-accent/30';
  const labelCls = 'text-xs font-semibold text-secondary block mb-1';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create & Score Test Order" subtitle="Test the end-to-end ML scoring and decision pipeline" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Customer Name</label>
            <input required className={inputCls} value={form.customerName} onChange={set('customerName')} placeholder="Aakash Mehra" />
          </div>
          <div>
            <label className={labelCls}>Order Value (₹)</label>
            <input required type="number" className={inputCls} value={form.orderValue} onChange={set('orderValue')} placeholder="649" />
          </div>
        </div>

        <div>
          <label className={labelCls}>Payment Method</label>
          <div className="flex gap-4">
            {['COD', 'PREPAID'].map((pm) => (
              <label key={pm} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="paymentMethod" value={pm} checked={form.paymentMethod === pm} onChange={set('paymentMethod')} className="accent-primary-accent" />
                <span className="text-xs font-semibold text-primary">{pm}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Full Delivery Address</label>
          <textarea required className={inputCls} rows={2} value={form.address} onChange={set('address')} placeholder="Flat 402, Sunshine Apts, Near Station" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>City</label>
            <input required className={inputCls} value={form.city} onChange={set('city')} placeholder="Gorakhpur" />
          </div>
          <div>
            <label className={labelCls}>State</label>
            <input required className={inputCls} value={form.state} onChange={set('state')} placeholder="Uttar Pradesh" />
          </div>
          <div>
            <label className={labelCls}>Pincode</label>
            <input required className={inputCls} value={form.pincode} onChange={set('pincode')} placeholder="273001" />
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

        <div className="flex justify-end gap-2 pt-2 border-t border-neutralBorder">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" isLoading={submitting}>Score & Save Order</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Main Orders Page ────────────────────────────────────────────────────────
export function OrdersPage() {
  const { onToggleMobileMenu } = useOutletContext() || {};
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
  const [filters, setFilters] = useState({ 
    decision: 'ALL', 
    riskTier: 'ALL', 
    paymentMethod: 'ALL',
    finalStatus: 'ALL' 
  });
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Debounce search input to avoid hitting API and rerendering on every keystroke
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const fetchOrders = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 15,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(filters.decision !== 'ALL' && { decision: filters.decision }),
        ...(filters.riskTier !== 'ALL' && { riskTier: filters.riskTier }),
        ...(filters.paymentMethod !== 'ALL' && { paymentMethod: filters.paymentMethod }),
        ...(filters.finalStatus !== 'ALL' && { finalStatus: filters.finalStatus }),
      };
      const res = await ordersApi.getOrders(params);
      setOrders(res.orders || []);
      setPagination({
        total: res.total || 0,
        page: res.page || 1,
        limit: res.limit || 15,
        totalPages: res.totalPages || 1
      });
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filters]);

  useEffect(() => { 
    fetchOrders(1); 
  }, [fetchOrders]);

  const openDetail = (id) => {
    setSelectedOrderId(id);
    setDrawerOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Header
        title="Order Intelligence Stream"
        subtitle="Search, filter, inspect AI explainability, and manually override decisions."
        onOpenNewOrder={() => setModalOpen(true)}
        onToggleMobileMenu={onToggleMobileMenu}
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* Search & Filter Bar */}
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter by Order ID, Customer, City, or Pincode…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2 rounded-lg border border-neutralBorder bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-accent/30 transition-all"
                />
              </div>

              {/* Dropdown Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Decision Filter */}
                <select
                  value={filters.decision}
                  onChange={(e) => setFilters(f => ({ ...f, decision: e.target.value }))}
                  className="text-xs font-medium rounded-lg border border-neutralBorder px-3 py-2 bg-white text-primary"
                >
                  <option value="ALL">All Decisions</option>
                  <option value="SHIP_AS_IS">Ship As-Is</option>
                  <option value="SHIP_AFTER_CONFIRMATION">Ship After Confirmation</option>
                  <option value="NUDGE_TO_PREPAID">Nudge to Prepaid</option>
                  <option value="HOLD_CANCEL">Hold / Cancel</option>
                </select>

                {/* Risk Tier Filter */}
                <select
                  value={filters.riskTier}
                  onChange={(e) => setFilters(f => ({ ...f, riskTier: e.target.value }))}
                  className="text-xs font-medium rounded-lg border border-neutralBorder px-3 py-2 bg-white text-primary"
                >
                  <option value="ALL">All Risk Tiers</option>
                  <option value="LOW">Low Risk</option>
                  <option value="MEDIUM">Medium Risk</option>
                  <option value="HIGH">High Risk</option>
                  <option value="CRITICAL">Critical Risk</option>
                </select>

                {/* Payment Method */}
                <select
                  value={filters.paymentMethod}
                  onChange={(e) => setFilters(f => ({ ...f, paymentMethod: e.target.value }))}
                  className="text-xs font-medium rounded-lg border border-neutralBorder px-3 py-2 bg-white text-primary"
                >
                  <option value="ALL">All Payments</option>
                  <option value="COD">COD Only</option>
                  <option value="PREPAID">Prepaid Only</option>
                </select>

                {/* Delivery Outcome / Status Filter */}
                <select
                  value={filters.finalStatus}
                  onChange={(e) => setFilters(f => ({ ...f, finalStatus: e.target.value }))}
                  className="text-xs font-medium rounded-lg border border-neutralBorder px-3 py-2 bg-white text-primary"
                >
                  <option value="ALL">All Outcomes</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="RTO">Returned (RTO)</option>
                  <option value="IN_TRANSIT">In Transit</option>
                </select>

                {/* Reset Filters */}
                {(searchTerm || filters.decision !== 'ALL' || filters.riskTier !== 'ALL' || filters.paymentMethod !== 'ALL' || filters.finalStatus !== 'ALL') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchTerm('');
                      setDebouncedSearch('');
                      setFilters({ decision: 'ALL', riskTier: 'ALL', paymentMethod: 'ALL', finalStatus: 'ALL' });
                    }}
                    className="text-xs text-secondary hover:text-primary gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-neutralBorder text-secondary font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Order ID</th>
                  <th className="py-3.5 px-4">Customer Details</th>
                  <th className="py-3.5 px-4">Destination</th>
                  <th className="py-3.5 px-4">Amount</th>
                  <th className="py-3.5 px-4">AI Risk Score</th>
                  <th className="py-3.5 px-4">Canonical Decision</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutralBorder/70">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-7 h-7 text-primary-accent animate-spin" />
                        <span className="text-xs text-secondary">Loading orders...</span>
                      </div>
                    </td>
                  </tr>
                ) : orders.length > 0 ? (
                  orders.map((o, idx) => (
                    <tr key={o.id ? `order-${o.orderId}-${o.id}` : `order-${o.orderId}-${idx}`} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-primary">
                        <button
                          onClick={() => openDetail(o.orderId)}
                          className="hover:underline text-primary-accent font-semibold"
                        >
                          {o.orderId}
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-primary">{o.customer?.name}</div>
                        <div className="text-[11px] text-secondary">
                          {o.customer?.priorOrders === 0 ? 'First-Time Customer' : `${o.customer?.priorOrders} orders (${o.customer?.priorRto} RTO)`}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-primary font-medium">{o.shipping?.city}</div>
                        <div className="text-[11px] text-secondary">{o.shipping?.state} - {o.shipping?.pincode}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-primary">
                        {formatCurrency(o.orderValue)}
                        <span className="text-[10px] text-secondary font-normal ml-1">({o.paymentMethod})</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <RiskScoreBar
                          score={o.riskAssessment?.riskScore || 0}
                          tier={o.riskAssessment?.riskTier || 'LOW'}
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <DecisionBadge decision={o.operationalDecision?.decision} />
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700">
                          {o.operationalDecision?.status || 'PENDING'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openDetail(o.orderId)}
                            className="h-7 px-2 text-xs gap-1"
                            title="Inspect AI explainability"
                          >
                            <Eye className="w-3.5 h-3.5" /> Inspect
                          </Button>
                          <Link to={`/whatsapp-simulator?orderId=${o.orderId}`}>
                            <Button size="sm" variant="secondary" className="h-7 px-2 text-xs gap-1">
                              <MessageSquare className="w-3.5 h-3.5 text-[#128C7E]" /> WhatsApp
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-secondary text-xs">
                      No orders matched your search or filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── Working Pagination ── */}
          {!loading && orders.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-neutralBorder bg-gray-50/50">
              <span className="text-xs text-secondary font-medium">
                Showing {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of <strong>{pagination.total}</strong> orders
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline" size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchOrders(pagination.page - 1)}
                  className="h-8 px-2.5 text-xs gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </Button>
                <span className="text-xs font-semibold font-mono text-primary px-3">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  variant="outline" size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchOrders(pagination.page + 1)}
                  className="h-8 px-2.5 text-xs gap-1"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </main>

      <OrderDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        orderId={selectedOrderId}
        onOverride={() => fetchOrders(pagination.page)}
      />

      <NewTestOrderModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(id) => { fetchOrders(1); if (id) openDetail(id); }}
      />
    </div>
  );
}
