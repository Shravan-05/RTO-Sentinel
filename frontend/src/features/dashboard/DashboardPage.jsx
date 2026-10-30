import React, { useState, useEffect } from 'react';
import { 
  TrendingDown, 
  TrendingUp, 
  ShieldAlert, 
  CheckCircle2, 
  IndianRupee, 
  PackageCheck, 
  ArrowUpRight, 
  AlertCircle,
  Truck,
  Sparkles,
  ArrowRight,
  Eye,
  MessageSquare
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  BarChart, 
  Bar, 
  Legend 
} from 'recharts';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { DecisionBadge, RiskTierBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Drawer } from '../../components/ui/Drawer';
import { Modal } from '../../components/ui/Modal';
import { formatCurrency, formatDate } from '../../lib/utils';
import { dashboardApi, ordersApi } from '../../services/api';

const DECISION_COLORS = {
  SHIP_AS_IS: '#12B76A',            // Emerald Green
  SHIP_AFTER_CONFIRMATION: '#2E90FA',// Info Blue
  NUDGE_TO_PREPAID: '#635BFF',       // Primary Accent Purple
  HOLD_CANCEL: '#F04438'             // Danger Red
};

export function DashboardPage() {
  const { onToggleMobileMenu } = useOutletContext() || {};
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('All Time');
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [cachedOverview, setCachedOverview] = useState(null);

  // New Order Form inside modal
  const [newOrderForm, setNewOrderForm] = useState({
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
  const [submittingOrder, setSubmittingOrder] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [period]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      if (period === 'Yesterday') {
        const [resYest, resOver] = await Promise.all([
          dashboardApi.getYesterday(),
          cachedOverview ? Promise.resolve(cachedOverview) : dashboardApi.getOverview()
        ]);
        if (!cachedOverview) setCachedOverview(resOver);

        setData({
          kpis: resYest.data.summary,
          decisionDistribution: resYest.data.decisionDistribution,
          unitEconomics: resYest.data.unitEconomics,
          monthlyTrends: resOver.monthlyTrends || [],
          highRiskAlerts: resOver.highRiskAlerts || []
        });
      } else {
        const res = await dashboardApi.getOverview();
        setCachedOverview(res);
        setData(res);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrderSubmit = async (e) => {
    e.preventDefault();
    setSubmittingOrder(true);
    try {
      const res = await ordersApi.createTestOrder({
        customerName: newOrderForm.customerName,
        orderValue: parseFloat(newOrderForm.orderValue) || 649,
        paymentMethod: newOrderForm.paymentMethod,
        shippingAddress: newOrderForm.address,
        city: newOrderForm.city,
        state: newOrderForm.state,
        pincode: newOrderForm.pincode,
        priorOrders: parseInt(newOrderForm.priorOrders) || 0,
        priorRtos: parseInt(newOrderForm.priorRtos) || 0,
      });
      setModalOpen(false);
      // Refresh dashboard
      fetchDashboardData();
      // Open detail drawer for newly created order
      const newId = res?.data?.orderId || res?.orderId;
      if (newId) {
        setSelectedOrderId(newId);
        setDrawerOpen(true);
      }
    } catch (err) {
      alert('Failed to create order: ' + err.message);
    } finally {
      setSubmittingOrder(false);
    }
  };

  const openDrawerForOrder = (id) => {
    setSelectedOrderId(id);
    setDrawerOpen(true);
  };

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-primary-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-secondary">Loading RTO intelligence...</p>
        </div>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const dist = data?.decisionDistribution || {};

  // Compute dynamic time-of-day greeting based on actual local time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 22) return 'Good evening';
    return 'Good night';
  };

  const donutData = [
    { name: 'Ship As-Is', key: 'SHIP_AS_IS', value: dist.SHIP_AS_IS?.count || 0, color: DECISION_COLORS.SHIP_AS_IS },
    { name: 'Ship After Confirmation', key: 'SHIP_AFTER_CONFIRMATION', value: dist.SHIP_AFTER_CONFIRMATION?.count || 0, color: DECISION_COLORS.SHIP_AFTER_CONFIRMATION },
    { name: 'Nudge to Prepaid', key: 'NUDGE_TO_PREPAID', value: dist.NUDGE_TO_PREPAID?.count || 0, color: DECISION_COLORS.NUDGE_TO_PREPAID },
    { name: 'Hold / Cancel', key: 'HOLD_CANCEL', value: dist.HOLD_CANCEL?.count || 0, color: DECISION_COLORS.HOLD_CANCEL },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Header
        title={`${getGreeting()}, here's your RTO intelligence.`}
        subtitle="Monitor order risk, prevent failed shipments and protect revenue."
        selectedPeriod={period}
        onPeriodChange={setPeriod}
        onOpenNewOrder={() => setModalOpen(true)}
        onToggleMobileMenu={onToggleMobileMenu}
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* Top 4 Primary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Total Orders */}
          <Card className="hover:shadow-card-hover transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-xs font-semibold uppercase tracking-wider">Total Orders</span>
                <PackageCheck className="w-4 h-4 text-primary-accent" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-primary tracking-tight font-mono">
                  {kpis.totalOrders?.toLocaleString() || '2,018'}
                </span>
                <span className="text-xs font-semibold text-emerald-600 flex items-center">
                  <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> +12.4%
                </span>
              </div>
              <p className="text-xs text-secondary mt-1">Evaluated across all Shopify channels</p>
            </CardContent>
          </Card>

          {/* Card 2: COD Orders */}
          <Card className="hover:shadow-card-hover transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-xs font-semibold uppercase tracking-wider">COD Orders</span>
                <IndianRupee className="w-4 h-4 text-amber-500" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-primary tracking-tight font-mono">
                  {kpis.codOrders?.toLocaleString() || '1,110'}
                </span>
                <span className="text-xs font-medium text-secondary">
                  ({kpis.codPercentage || '55.0'}%)
                </span>
              </div>
              <p className="text-xs text-secondary mt-1">Cash on Delivery exposure</p>
            </CardContent>
          </Card>

          {/* Card 3: COD RTO Rate */}
          <Card className="hover:shadow-card-hover transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-xs font-semibold uppercase tracking-wider">Protected COD RTO Rate</span>
                <Truck className="w-4 h-4 text-rose-500" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-rose-600 tracking-tight font-mono">
                  {kpis.projectedCodRtoRate || '14.8'}%
                </span>
                <span className="text-xs font-semibold text-emerald-600 flex items-center" title="Reduced from 28.4% baseline">
                  <TrendingDown className="w-3.5 h-3.5 mr-0.5" /> −13.6%
                </span>
              </div>
              <p className="text-xs text-secondary mt-1">Suppressed from 28.4% unmitigated baseline</p>
            </CardContent>
          </Card>

          {/* Card 4: Estimated RTO Loss Avoided */}
          <Card className="hover:shadow-card-hover transition-all bg-emerald-50/30 border-emerald-200/80">
            <CardContent className="p-6">
              <div className="flex items-center justify-between text-secondary">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">RTO Losses Avoided</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-emerald-700 tracking-tight font-mono">
                  {formatCurrency(kpis.estimatedRtoLossAvoided || 45200)}
                </span>
              </div>
              <p className="text-xs text-emerald-700/80 mt-1 font-medium">
                {kpis.totalRtoAvoided || 267} return courier waste stopped
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Featured Financial Intelligence Banner (Stripe-Grade Highlight) */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sidebar via-[#192339] to-sidebar text-white p-6 sm:p-8 shadow-card border border-sidebar-border">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-accent/20 border border-primary-accent/30 text-indigo-200 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-primary-accent" />
                <span>Unit Economics & Revenue Protection</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {formatCurrency(kpis.netFinancialImpact || 41850)}
                <span className="text-base sm:text-lg font-normal text-secondary-light ml-2">Net Bottom-Line Uplift</span>
              </h2>
              <p className="text-xs sm:text-sm text-secondary-light leading-relaxed">
                Balancing courier return savings (₹169.40/order) against customer lifetime value, preserving ₹300 CAC on first-time genuine buyers.
              </p>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 bg-white/5 backdrop-blur-md p-4 rounded-xl border border-white/10 shrink-0">
              <div className="text-center px-4 py-1 border-r border-white/10">
                <div className="text-xs text-secondary-light uppercase font-semibold">ROI Multiplier</div>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">{kpis.roiMultiplier || '18.5'}x</div>
              </div>
              <div className="text-center px-4 py-1">
                <div className="text-xs text-secondary-light uppercase font-semibold">Intervention Costs</div>
                <div className="text-2xl font-bold font-mono text-white/90 mt-0.5">{formatCurrency(kpis.totalInterventionCosts || 2350)}</div>
              </div>
              <Link to="/analytics">
                <Button variant="primary" size="sm" className="ml-2 gap-1.5 shadow-md">
                  View Backtest <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Operational Decision Distribution Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Decision Donut & Percentages */}
          <Card className="lg:col-span-1 flex flex-col justify-between">
            <CardHeader>
              <div>
                <CardTitle>Canonical Decision Routing</CardTitle>
                <CardDescription>Automated 4-bucket operational fulfillment queues</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pt-2 pb-6">
              <div className="h-52 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val, name) => [`${val} orders (${Math.round((val / (kpis.totalOrders || 1)) * 100)}%)`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-primary font-mono">{kpis.totalOrders || 0}</span>
                  <span className="text-[10px] uppercase font-semibold text-secondary tracking-wider">Orders</span>
                </div>
              </div>

              {/* Bucket Breakdown List */}
              <div className="space-y-3 mt-4 pt-4 border-t border-neutralBorder">
                {donutData.map((d) => (
                  <div key={d.key} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="font-medium text-primary">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="font-semibold text-primary">{d.value}</span>
                      <span className="text-secondary w-12 text-right">
                        ({Math.round((d.value / (kpis.totalOrders || 1)) * 100)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Monthly Trend & Performance Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
                <div>
                  <CardTitle>COD RTO Prevention Trend</CardTitle>
                  <CardDescription>Baseline courier failure rate vs. Sentinel-protected rate</CardDescription>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium shrink-0">
                  <span className="flex items-center gap-1.5 text-secondary">
                    <span className="w-2.5 h-0.5 bg-rose-400 inline-block" /> Baseline (Unmitigated)
                  </span>
                  <span className="flex items-center gap-1.5 text-primary-accent font-semibold">
                    <span className="w-2.5 h-0.5 bg-primary-accent inline-block" /> RTO Sentinel
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data?.monthlyTrends || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAECF0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#667085' }} />
                    <YAxis unit="%" tick={{ fontSize: 11, fill: '#667085' }} domain={[0, 40]} />
                    <Tooltip
                      formatter={(val) => [`${val}%`, '']}
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #EAECF0', fontSize: '12px' }}
                    />
                    <Line type="monotone" dataKey="baselineRtoRate" stroke="#F04438" strokeWidth={2} dot={{ r: 3 }} name="Baseline COD RTO" />
                    <Line type="monotone" dataKey="projectedRtoRate" stroke="#635BFF" strokeWidth={2.5} dot={{ r: 4 }} name="Protected COD RTO" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary-accent shrink-0" />
                  <span>
                    <strong>Business Result:</strong> Average COD RTO rate reduced from <strong>28.4%</strong> to <strong>14.8%</strong>, safeguarding genuine first-time customers.
                  </span>
                </div>
                <Link to="/analytics" className="font-semibold text-primary-accent hover:underline flex items-center gap-1 shrink-0">
                  Explore Policy Backtest <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Critical & High-Risk Interventions Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  Critical & High-Risk Orders Pending Review
                </CardTitle>
                <CardDescription>Orders requiring immediate automated WhatsApp confirmation or warehouse hold action</CardDescription>
              </div>
              <Link to="/orders">
                <Button variant="outline" size="sm" className="gap-1 text-xs shrink-0">
                  View All Orders <ArrowUpRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-neutralBorder text-secondary font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Order ID</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Destination</th>
                  <th className="py-3.5 px-4">Value</th>
                  <th className="py-3.5 px-4">Risk Assessment</th>
                  <th className="py-3.5 px-4">Canonical Decision</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutralBorder/70">
                {data?.highRiskAlerts?.length > 0 ? (
                  data.highRiskAlerts.map((o) => (
                    <tr key={o.orderId} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-primary">
                        <button
                          onClick={() => openDrawerForOrder(o.orderId)}
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
                      </td>
                      <td className="py-3.5 px-4">
                        <RiskTierBadge tier={o.riskAssessment?.riskTier} score={o.riskAssessment?.riskScore} />
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
                            onClick={() => openDrawerForOrder(o.orderId)}
                            className="h-7 px-2 text-xs gap-1"
                            title="Inspect ML explainability factors"
                          >
                            <Eye className="w-3.5 h-3.5" /> Inspect
                          </Button>
                          <Link to={`/whatsapp-simulator?orderId=${o.orderId}`}>
                            <Button size="sm" variant="secondary" className="h-7 px-2 text-xs gap-1">
                              <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-secondary">
                      No critical orders currently pending review.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>

      {/* Modal: New Test Order */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create & Score Test Order"
        subtitle="Simulate an incoming Shopify checkout order to test real-time AI prediction"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateOrderSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-secondary block mb-1">Customer Name</label>
              <input
                required
                className="w-full text-sm rounded-lg border border-neutralBorder px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-accent/30"
                value={newOrderForm.customerName}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, customerName: e.target.value })}
                placeholder="Rohit Verma"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-secondary block mb-1">Order Value (₹)</label>
              <input
                required
                type="number"
                className="w-full text-sm rounded-lg border border-neutralBorder px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-accent/30 font-mono"
                value={newOrderForm.orderValue}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, orderValue: e.target.value })}
                placeholder="649"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-secondary block mb-1">Payment Method</label>
            <div className="flex gap-4">
              {['COD', 'PREPAID'].map((pm) => (
                <label key={pm} className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={pm}
                    checked={newOrderForm.paymentMethod === pm}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, paymentMethod: e.target.value })}
                    className="accent-primary-accent"
                  />
                  <span>{pm}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-secondary block mb-1">Full Delivery Address</label>
            <textarea
              required
              rows={2}
              className="w-full text-sm rounded-lg border border-neutralBorder px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-accent/30 resize-none"
              value={newOrderForm.address}
              onChange={(e) => setNewOrderForm({ ...newOrderForm, address: e.target.value })}
              placeholder="Flat 302, Palm Grove Apts, Near Apollo Hospital"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-secondary block mb-1">City</label>
              <input
                required
                className="w-full text-sm rounded-lg border border-neutralBorder px-3 py-2 bg-white"
                value={newOrderForm.city}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, city: e.target.value })}
                placeholder="Mumbai"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-secondary block mb-1">State</label>
              <input
                required
                className="w-full text-sm rounded-lg border border-neutralBorder px-3 py-2 bg-white"
                value={newOrderForm.state}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, state: e.target.value })}
                placeholder="Maharashtra"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-secondary block mb-1">Pincode</label>
              <input
                required
                className="w-full text-sm rounded-lg border border-neutralBorder px-3 py-2 bg-white font-mono"
                value={newOrderForm.pincode}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, pincode: e.target.value })}
                placeholder="400050"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-secondary block mb-1">Prior Delivered Orders</label>
              <input
                type="number"
                min="0"
                className="w-full text-sm rounded-lg border border-neutralBorder px-3 py-2 bg-white"
                value={newOrderForm.priorOrders}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, priorOrders: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-secondary block mb-1">Prior RTOs</label>
              <input
                type="number"
                min="0"
                className="w-full text-sm rounded-lg border border-neutralBorder px-3 py-2 bg-white"
                value={newOrderForm.priorRtos}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, priorRtos: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-neutralBorder">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submittingOrder}>
              Analyze & Save Order
            </Button>
          </div>
        </form>
      </Modal>

      {/* Drawer: Order Detail */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedOrderId ? `Order ${selectedOrderId}` : 'Order Detail'}
        subtitle="Full ML explainability and address intelligence"
      >
        <OrderDetailContent
          orderId={selectedOrderId}
          onOverride={() => fetchDashboardData()}
        />
      </Drawer>
    </div>
  );
}

// Reusable Order Detail Content component for Drawer
function OrderDetailContent({ orderId, onOverride }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [overrideDecision, setOverrideDecision] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overriding, setOverriding] = useState(false);

  useEffect(() => {
    if (orderId) {
      setLoading(true);
      ordersApi.getOrderById(orderId)
        .then(setOrder)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [orderId]);

  const handleApplyOverride = async () => {
    if (!overrideDecision) return;
    setOverriding(true);
    try {
      await ordersApi.overrideDecision(orderId, {
        decision: overrideDecision,
        reason: overrideReason
      });
      setShowOverrideForm(false);
      const updated = await ordersApi.getOrderById(orderId);
      setOrder(updated);
      if (onOverride) onOverride();
    } catch (err) {
      alert('Override failed: ' + err.message);
    } finally {
      setOverriding(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-primary-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) return null;

  const riskFactors = order.riskAssessment?.riskFactors || order.aiPrediction?.risk_factors || [];
  const addressVal = order.addressValidation || order.aiPrediction?.address_validation;
  const financial = order.financialImpact || order.decisionAnalysis?.financialImpact;

  return (
    <div className="space-y-6">
      {/* Metadata */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-secondary mb-3">Order Details</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-gray-50 rounded-xl">
            <span className="text-secondary block">Customer:</span>
            <span className="font-semibold text-primary">{order.customer?.name}</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl">
            <span className="text-secondary block">Value:</span>
            <span className="font-bold font-mono text-primary">{formatCurrency(order.orderValue)} ({order.paymentMethod})</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl">
            <span className="text-secondary block">History:</span>
            <span className="font-semibold text-primary">{order.customer?.priorOrders || 0} orders ({order.customer?.priorRto || 0} RTO)</span>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl">
            <span className="text-secondary block">Destination:</span>
            <span className="font-semibold text-primary">{order.shipping?.city}, {order.shipping?.state}</span>
          </div>
        </div>
      </div>

      {/* Decision */}
      <div className="p-4 bg-gray-50 rounded-xl border border-neutralBorder">
        <div className="flex items-center justify-between mb-2">
          <DecisionBadge decision={order.operationalDecision?.decision} />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowOverrideForm(!showOverrideForm)}
            className="text-xs"
          >
            {showOverrideForm ? 'Cancel' : 'Override Decision'}
          </Button>
        </div>
        <p className="text-xs text-secondary mt-1">{order.operationalDecision?.reason}</p>

        {showOverrideForm && (
          <div className="mt-3 pt-3 border-t border-neutralBorder space-y-2">
            <select
              value={overrideDecision}
              onChange={(e) => setOverrideDecision(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-neutralBorder bg-white"
            >
              <option value="">Select new decision...</option>
              <option value="SHIP_AS_IS">Ship As-Is</option>
              <option value="SHIP_AFTER_CONFIRMATION">Ship After Confirmation</option>
              <option value="NUDGE_TO_PREPAID">Nudge to Prepaid</option>
              <option value="HOLD_CANCEL">Hold / Cancel</option>
            </select>
            <input
              type="text"
              placeholder="Reason for manual override..."
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="w-full text-xs p-2 rounded-lg border border-neutralBorder bg-white"
            />
            <Button
              size="sm"
              variant="primary"
              disabled={!overrideDecision}
              isLoading={overriding}
              onClick={handleApplyOverride}
            >
              Confirm Override
            </Button>
          </div>
        )}
      </div>

      {/* Risk Factors */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-secondary mb-3">AI Risk Factors</h3>
        <div className="space-y-2">
          {riskFactors.length > 0 ? (
            riskFactors.map((f, i) => (
              <div key={i} className="p-3 rounded-xl border border-neutralBorder bg-white text-xs">
                <div className="flex items-center justify-between font-semibold mb-1">
                  <span>{f.feature}</span>
                  <span className={f.impact === 'RISK_INCREASING' ? 'text-rose-600' : 'text-emerald-600'}>
                    {f.impact === 'RISK_INCREASING' ? '▲ Risk Increasing' : '▼ Risk Decreasing'}
                  </span>
                </div>
                <p className="text-secondary">{f.description}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-secondary italic">Standard risk profile.</p>
          )}
        </div>
      </div>

      {/* Address Validation */}
      {addressVal && (
        <div className="p-4 rounded-xl border border-neutralBorder bg-white space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-primary">Delivery Address Quality</span>
            <span className="font-bold font-mono text-primary-accent">{addressVal.qualityScore || addressVal.quality_score}/100</span>
          </div>
          <div className="text-xs text-secondary">{order.shipping?.address}</div>
          {addressVal.issues?.length > 0 && (
            <div className="pt-2 text-xs text-amber-700 space-y-1">
              {addressVal.issues.map((iss, i) => (
                <div key={i}>⚠ {iss}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* WhatsApp Link */}
      <div className="pt-2">
        <Link to={`/whatsapp-simulator?orderId=${order.orderId}`} className="block">
          <Button variant="secondary" size="md" className="w-full gap-2">
            <MessageSquare className="w-4 h-4" /> Open in WhatsApp Simulator
          </Button>
        </Link>
      </div>
    </div>
  );
}
