import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  MapPin, 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  ShieldCheck, 
  FileSpreadsheet, 
  ArrowRight, 
  CheckCircle2, 
  XCircle,
  HelpCircle,
  Sparkles
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  Cell 
} from 'recharts';
import { Header } from '../../components/layout/Header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../lib/utils';
import { dashboardApi } from '../../services/api';
import { useOutletContext } from 'react-router-dom';

export function AnalyticsPage() {
  const { onToggleMobileMenu } = useOutletContext() || {};
  const [activeTab, setActiveTab] = useState('backtest'); // 'backtest' | 'geographic'
  const [loading, setLoading] = useState(true);
  const [backtestData, setBacktestData] = useState(null);
  const [geoData, setGeoData] = useState([]);
  const [error, setError] = useState(null);
  const [citySearch, setCitySearch] = useState('');
  const [riskCategoryFilter, setRiskCategoryFilter] = useState('ALL');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bt, geo] = await Promise.all([
        dashboardApi.getBacktest(),
        dashboardApi.getGeographic()
      ]);
      setBacktestData(bt);
      setGeoData(geo);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const topCities = [...geoData]
    .filter(c => c.cod >= 8)
    .sort((a, b) => b.rtoRate - a.rtoRate)
    .slice(0, 10);

  const policyChartData = backtestData?.policies?.map(p => ({
    name: p.name.split(' (')[0],
    netProfit: p.netRupeeContribution,
    rtoCost: p.rtoLogisticsLoss,
    isRecommended: p.isRecommended
  })) || [];

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Header
        title="Analytics & Policy Backtesting"
        subtitle="Historical simulations, geographic risk heatmaps, and financial policy comparisons"
        onToggleMobileMenu={onToggleMobileMenu}
      />

      <main className="flex-1 p-8 space-y-6 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* Navigation Tabs */}
        <div className="flex border-b border-neutralBorder">
          <button
            onClick={() => setActiveTab('backtest')}
            className={`flex items-center gap-2 py-3 px-6 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'backtest'
                ? 'border-primary-accent text-primary-accent'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Policy Backtesting (2,018 Orders)</span>
          </button>
          <button
            onClick={() => setActiveTab('geographic')}
            className={`flex items-center gap-2 py-3 px-6 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'geographic'
                ? 'border-primary-accent text-primary-accent'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Geographic & Address Analysis</span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === 'backtest' ? (
          /* TAB 1: POLICY BACKTESTING */
          <div className="space-y-8">
            {/* Context Banner */}
            <div className="p-4 bg-indigo-50/70 rounded-xl border border-indigo-100 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-primary-accent shrink-0 mt-0.5" />
              <div className="text-xs text-indigo-950 space-y-1">
                <div className="font-semibold text-sm text-indigo-900">
                  Historical Counterfactual Simulation
                </div>
                <p>
                  We simulated 4 operational policies across the <strong>2,018 real orders</strong> in the dataset. 
                  Unit economics applied: ₹649 AOV, 62% gross margin (₹402.38 profit/delivered), ₹169.40 RTO courier cost, and ₹300 customer acquisition cost (CAC).
                </p>
              </div>
            </div>

            {/* Policy Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {backtestData?.policies?.map((policy) => {
                const isBest = policy.isRecommended;
                return (
                  <Card 
                    key={policy.id} 
                    className={`relative overflow-hidden transition-all ${
                      isBest 
                        ? 'border-primary-accent shadow-card-hover bg-gradient-to-b from-white to-indigo-50/20 ring-1 ring-primary-accent' 
                        : 'hover:shadow-card-hover'
                    }`}
                  >
                    {isBest && (
                      <div className="bg-primary-accent text-white text-[10px] font-bold uppercase tracking-wider py-1 px-3 text-center">
                        ⭐ Recommended Policy
                      </div>
                    )}
                    <CardHeader className="pb-3">
                      <div>
                        <CardTitle className="text-sm font-bold">{policy.name}</CardTitle>
                        <CardDescription className="text-[11px] line-clamp-2 mt-1">
                          {policy.description}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-0">
                      {/* Net Contribution */}
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <span className="text-[11px] font-medium text-secondary uppercase block">
                          Net Rupee Contribution
                        </span>
                        <span className={`text-xl font-bold font-mono ${isBest ? 'text-primary-accent' : 'text-primary'}`}>
                          {formatCurrency(policy.netRupeeContribution)}
                        </span>
                        {policy.deltaVsBaseline !== 0 && (
                          <div className={`text-xs font-semibold mt-0.5 ${policy.deltaVsBaseline > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {policy.deltaVsBaseline > 0 ? `+${formatCurrency(policy.deltaVsBaseline)} vs baseline` : `${formatCurrency(policy.deltaVsBaseline)} vs baseline`}
                          </div>
                        )}
                      </div>

                      {/* Metrics breakdown */}
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-neutralBorder/50">
                          <span className="text-secondary">Delivered Orders:</span>
                          <span className="font-semibold font-mono text-primary">{policy.deliveredOrders}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-neutralBorder/50">
                          <span className="text-secondary">RTO Failures:</span>
                          <span className="font-semibold font-mono text-rose-600">{policy.rtoOrders}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-neutralBorder/50">
                          <span className="text-secondary">Effective RTO Rate:</span>
                          <span className="font-semibold font-mono">{policy.rtoRatePct}%</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-neutralBorder/50">
                          <span className="text-secondary">RTO Logistics Waste:</span>
                          <span className="font-mono text-rose-600">−{formatCurrency(policy.rtoLogisticsLoss)}</span>
                        </div>
                        {policy.cacWastedOnCancellations > 0 && (
                          <div className="flex justify-between py-1 border-b border-neutralBorder/50">
                            <span className="text-secondary">CAC Wasted:</span>
                            <span className="font-mono text-rose-600">−{formatCurrency(policy.cacWastedOnCancellations)}</span>
                          </div>
                        )}
                        {policy.interventionCosts > 0 && (
                          <div className="flex justify-between py-1 border-b border-neutralBorder/50">
                            <span className="text-secondary">Intervention Costs:</span>
                            <span className="font-mono text-secondary">−{formatCurrency(policy.interventionCosts)}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Financial Contribution Chart */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Net Contribution Comparison by Policy</CardTitle>
                  <CardDescription>
                    Demonstrating why balanced arbitration beats blind cancellation
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={policyChartData} margin={{ top: 10, right: 20, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAECF0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#667085' }} />
                      <YAxis 
                        tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} 
                        tick={{ fontSize: 11, fill: '#667085' }} 
                      />
                      <Tooltip 
                        formatter={(val) => [formatCurrency(val), 'Net Contribution']}
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #EAECF0', fontSize: '12px' }}
                      />
                      <Bar dataKey="netProfit" radius={[6, 6, 0, 0]}>
                        {policyChartData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.isRecommended ? '#635BFF' : '#94A3B8'} 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* TAB 2: GEOGRAPHIC & ADDRESS ANALYSIS */
          <div className="space-y-8">
            {/* Key Findings 4-Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4 bg-amber-50/50 border-amber-200">
                <div className="flex items-center gap-2 text-amber-800 font-semibold text-xs mb-1">
                  <Users className="w-4 h-4" /> The First-Timer Dilemma
                </div>
                <div className="text-xl font-bold font-mono text-amber-900 mt-2">75.2%</div>
                <p className="text-xs text-amber-800/80 mt-1">
                  Of orders are from new buyers (30.3% RTO). Cancelling them forfeits ₹402.38 profit + ₹300 CAC vs ₹169.40 RTO cost.
                </p>
              </Card>

              <Card className="p-4 bg-rose-50/50 border-rose-200">
                <div className="flex items-center gap-2 text-rose-800 font-semibold text-xs mb-1">
                  <AlertTriangle className="w-4 h-4" /> Vague Address Signal
                </div>
                <div className="text-xl font-bold font-mono text-rose-900 mt-2">62.0% RTO</div>
                <p className="text-xs text-rose-800/80 mt-1">
                  Addresses with &lt;10 characters or placeholder words ("home", "xyz") have 2.48× higher failure rate than clean addresses (25.0%).
                </p>
              </Card>

              <Card className="p-4 bg-purple-50/50 border-purple-200">
                <div className="flex items-center gap-2 text-purple-800 font-semibold text-xs mb-1">
                  <XCircle className="w-4 h-4" /> Repeat RTO Re-offenders
                </div>
                <div className="text-xl font-bold font-mono text-purple-900 mt-2">76.5% RTO</div>
                <p className="text-xs text-purple-800/80 mt-1">
                  Customers with 2+ past RTO records fail over 3 in 4 delivery attempts. Immediate hold unless converted to prepaid.
                </p>
              </Card>

              <Card className="p-4 bg-blue-50/50 border-blue-200">
                <div className="flex items-center gap-2 text-blue-800 font-semibold text-xs mb-1">
                  <MapPin className="w-4 h-4" /> Geographic Concentration
                </div>
                <div className="text-xl font-bold font-mono text-blue-900 mt-2">45.0%</div>
                <p className="text-xs text-blue-800/80 mt-1">
                  Of total return losses originate from Tier-2/3 delivery hubs in Bihar and Uttar Pradesh (Gorakhpur, Bareilly, Darbhanga).
                </p>
              </Card>
            </div>

            {/* Top 10 High RTO Cities Chart */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Top Cities by COD Return Rate (Min 8 Orders)</CardTitle>
                  <CardDescription>Severe geographic disparity between Tier-1 Metros vs. Tier-2/3 Towns</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topCities} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAECF0" />
                      <XAxis dataKey="city" tick={{ fontSize: 11, fill: '#667085' }} />
                      <YAxis unit="%" tick={{ fontSize: 11, fill: '#667085' }} domain={[0, 80]} />
                      <Tooltip 
                        formatter={(val) => [`${val}%`, 'COD RTO Rate']}
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #EAECF0', fontSize: '12px' }}
                      />
                      <Bar dataKey="rtoRate" fill="#F04438" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Full Geographic Table with Dynamic Search & Risk Filter */}
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>All Delivery Cities Breakdown</CardTitle>
                  <CardDescription>Filter geographic risk, order volume, and return rates</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search city name..."
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    className="text-xs rounded-lg border border-neutralBorder px-3 py-1.5 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-accent/30 w-40 sm:w-48"
                  />
                  <select
                    value={riskCategoryFilter}
                    onChange={(e) => setRiskCategoryFilter(e.target.value)}
                    className="text-xs rounded-lg border border-neutralBorder px-2.5 py-1.5 bg-white text-primary"
                  >
                    <option value="ALL">All Risk Levels</option>
                    <option value="CRITICAL">Critical Risk (≥40%)</option>
                    <option value="MEDIUM">Medium Risk (25-39%)</option>
                    <option value="LOW">Low Risk (&lt;25%)</option>
                  </select>
                </div>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-50/80 border-b border-neutralBorder text-secondary font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">City</th>
                      <th className="py-3 px-4">Total Orders</th>
                      <th className="py-3 px-4">COD Orders</th>
                      <th className="py-3 px-4">Delivered</th>
                      <th className="py-3 px-4">RTO Count</th>
                      <th className="py-3 px-4">COD RTO Rate</th>
                      <th className="py-3 px-4">Risk Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutralBorder/70">
                    {geoData
                      .filter((c) => {
                        const matchesName = !citySearch.trim() || c.city.toLowerCase().includes(citySearch.trim().toLowerCase());
                        if (!matchesName) return false;
                        if (riskCategoryFilter === 'CRITICAL') return c.rtoRate >= 40;
                        if (riskCategoryFilter === 'MEDIUM') return c.rtoRate >= 25 && c.rtoRate < 40;
                        if (riskCategoryFilter === 'LOW') return c.rtoRate < 25;
                        return true;
                      })
                      .map((c) => {
                      const rate = c.rtoRate;
                      let badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                      let cat = 'Low Risk';
                      if (rate >= 40) {
                        badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
                        cat = 'Critical Risk';
                      } else if (rate >= 25) {
                        badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                        cat = 'Medium Risk';
                      }

                      return (
                        <tr key={c.city} className="hover:bg-gray-50/80">
                          <td className="py-2.5 px-4 font-semibold text-primary">{c.city}</td>
                          <td className="py-2.5 px-4 font-mono">{c.total}</td>
                          <td className="py-2.5 px-4 font-mono">{c.cod}</td>
                          <td className="py-2.5 px-4 font-mono text-emerald-600">{c.delivered}</td>
                          <td className="py-2.5 px-4 font-mono text-rose-600">{c.rto}</td>
                          <td className="py-2.5 px-4 font-mono font-bold">{rate}%</td>
                          <td className="py-2.5 px-4">
                            <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${badgeColor}`}>
                              {cat}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

