import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Coins, 
  ShieldCheck, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { Header } from '../../components/layout/Header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DecisionBadge } from '../../components/ui/Badge';
import { formatCurrency } from '../../lib/utils';
import { settingsApi } from '../../services/api';
import { useOutletContext } from 'react-router-dom';

export function SettingsPage() {
  const { onToggleMobileMenu } = useOutletContext() || {};
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [settings, setSettings] = useState({
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
    economics: {
      aov: 649,
      grossMarginPct: 0.62,
      forwardShipping: 65,
      returnShipping: 65,
      packagingHandling: 25,
      damageProbability: 0.08,
      avgProductCost: 180,
      cacNewCustomer: 300,
      whatsAppCostPerMsg: 0.50
    }
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await settingsApi.getSettings();
      if (data) {
        setSettings(prev => ({
          ...prev,
          ...data,
          thresholds: { ...prev.thresholds, ...(data.thresholds || {}) },
          policies: { ...prev.policies, ...(data.policies || {}) },
          economics: { ...prev.economics, ...(data.economics || {}) }
        }));
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedSuccess(false);
    try {
      await settingsApi.updateSettings(settings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Error updating settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const econ = settings.economics;
  const calculatedRtoCost = (
    econ.forwardShipping + 
    econ.returnShipping + 
    econ.packagingHandling + 
    (econ.damageProbability * econ.avgProductCost)
  );
  const calculatedGrossProfit = econ.aov * econ.grossMarginPct;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Header
        title="Platform & Risk Settings"
        subtitle="Configure ML thresholds, canonical decision routing policies, and reverse logistics unit economics"
        onToggleMobileMenu={onToggleMobileMenu}
      />

      <main className="flex-1 p-8 space-y-8 overflow-y-auto max-w-5xl mx-auto w-full">
        {savedSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-800 text-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span><strong>Settings persisted!</strong> New thresholds and economic rules are now actively enforced.</span>
            </div>
          </div>
        )}

        {/* Section 1: Risk Thresholds & Canonical Decision Policy */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between w-full">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-primary-accent" />
                  Risk Thresholds & Canonical Routing Policies
                </CardTitle>
                <CardDescription>
                  Define the score boundaries (0–100) and operational actions for each risk tier
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Visual Threshold Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-secondary">
                <span>0</span>
                <span>Tier Cutoffs: {settings.thresholds.lowMax} | {settings.thresholds.mediumMax} | {settings.thresholds.highMax}</span>
                <span>100</span>
              </div>
              <div className="h-4 rounded-full flex overflow-hidden border border-neutralBorder shadow-inner">
                <div 
                  className="bg-emerald-500 transition-all flex items-center justify-center text-[9px] text-white font-bold"
                  style={{ width: `${settings.thresholds.lowMax}%` }}
                >
                  LOW
                </div>
                <div 
                  className="bg-blue-500 transition-all flex items-center justify-center text-[9px] text-white font-bold"
                  style={{ width: `${settings.thresholds.mediumMax - settings.thresholds.lowMax}%` }}
                >
                  MEDIUM
                </div>
                <div 
                  className="bg-purple-500 transition-all flex items-center justify-center text-[9px] text-white font-bold"
                  style={{ width: `${settings.thresholds.highMax - settings.thresholds.mediumMax}%` }}
                >
                  HIGH
                </div>
                <div 
                  className="bg-rose-500 transition-all flex items-center justify-center text-[9px] text-white font-bold"
                  style={{ width: `${100 - settings.thresholds.highMax}%` }}
                >
                  CRITICAL
                </div>
              </div>
            </div>

            {/* Threshold Sliders */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              {/* Low Risk Slider */}
              <div className="p-4 bg-emerald-50/40 rounded-xl border border-emerald-200/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 uppercase">Low Risk Limit</span>
                  <span className="font-mono font-bold text-sm bg-white px-2 py-0.5 rounded border border-emerald-300">
                    ≤ {settings.thresholds.lowMax}
                  </span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="45"
                  value={settings.thresholds.lowMax}
                  onChange={(e) => setSettings({
                    ...settings,
                    thresholds: { ...settings.thresholds, lowMax: parseInt(e.target.value) }
                  })}
                  className="w-full accent-emerald-600"
                />
                <div className="pt-2 text-xs">
                  <label className="text-secondary block mb-1">Assigned Bucket:</label>
                  <select
                    value={settings.policies.lowAction}
                    onChange={(e) => setSettings({
                      ...settings,
                      policies: { ...settings.policies, lowAction: e.target.value }
                    })}
                    className="w-full text-xs font-semibold p-1.5 rounded border border-neutralBorder bg-white"
                  >
                    <option value="SHIP_AS_IS">SHIP_AS_IS (Fast-track)</option>
                    <option value="SHIP_AFTER_CONFIRMATION">SHIP_AFTER_CONFIRMATION</option>
                  </select>
                </div>
              </div>

              {/* Medium Risk Slider */}
              <div className="p-4 bg-blue-50/40 rounded-xl border border-blue-200/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 uppercase">Medium Risk Limit</span>
                  <span className="font-mono font-bold text-sm bg-white px-2 py-0.5 rounded border border-blue-300">
                    ≤ {settings.thresholds.mediumMax}
                  </span>
                </div>
                <input
                  type="range"
                  min="46"
                  max="65"
                  value={settings.thresholds.mediumMax}
                  onChange={(e) => setSettings({
                    ...settings,
                    thresholds: { ...settings.thresholds, mediumMax: parseInt(e.target.value) }
                  })}
                  className="w-full accent-blue-600"
                />
                <div className="pt-2 text-xs">
                  <label className="text-secondary block mb-1">Assigned Bucket:</label>
                  <select
                    value={settings.policies.mediumAction}
                    onChange={(e) => setSettings({
                      ...settings,
                      policies: { ...settings.policies, mediumAction: e.target.value }
                    })}
                    className="w-full text-xs font-semibold p-1.5 rounded border border-neutralBorder bg-white"
                  >
                    <option value="SHIP_AFTER_CONFIRMATION">SHIP_AFTER_CONFIRMATION (WhatsApp)</option>
                    <option value="NUDGE_TO_PREPAID">NUDGE_TO_PREPAID</option>
                    <option value="SHIP_AS_IS">SHIP_AS_IS</option>
                  </select>
                </div>
              </div>

              {/* High Risk Slider */}
              <div className="p-4 bg-purple-50/40 rounded-xl border border-purple-200/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 uppercase">High Risk Limit</span>
                  <span className="font-mono font-bold text-sm bg-white px-2 py-0.5 rounded border border-purple-300">
                    ≤ {settings.thresholds.highMax}
                  </span>
                </div>
                <input
                  type="range"
                  min="66"
                  max="85"
                  value={settings.thresholds.highMax}
                  onChange={(e) => setSettings({
                    ...settings,
                    thresholds: { ...settings.thresholds, highMax: parseInt(e.target.value) }
                  })}
                  className="w-full accent-purple-600"
                />
                <div className="pt-2 text-xs">
                  <label className="text-secondary block mb-1">Assigned Bucket:</label>
                  <select
                    value={settings.policies.highAction}
                    onChange={(e) => setSettings({
                      ...settings,
                      policies: { ...settings.policies, highAction: e.target.value }
                    })}
                    className="w-full text-xs font-semibold p-1.5 rounded border border-neutralBorder bg-white"
                  >
                    <option value="NUDGE_TO_PREPAID">NUDGE_TO_PREPAID (₹20 Discount)</option>
                    <option value="HOLD_CANCEL">HOLD_CANCEL</option>
                    <option value="SHIP_AFTER_CONFIRMATION">SHIP_AFTER_CONFIRMATION</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Guardrail Policy Toggles */}
            <div className="pt-4 border-t border-neutralBorder space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-secondary">
                Marketing Protection Guardrails
              </h4>
              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-neutralBorder">
                <div>
                  <span className="text-sm font-semibold text-primary block">
                    Protect First-Time Customers
                  </span>
                  <span className="text-xs text-secondary">
                    Never auto-cancel genuine first-time buyers. Always attempt WhatsApp verification or ₹20 prepaid nudge to preserve ₹300 CAC.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={settings.protectFirstTimeBuyers}
                  onChange={(e) => setSettings({
                    ...settings,
                    protectFirstTimeBuyers: e.target.checked
                  })}
                  className="w-5 h-5 accent-primary-accent rounded cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 bg-gray-50 rounded-xl border border-neutralBorder flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-primary block">
                      Prepaid Nudge Discount
                    </span>
                    <span className="text-[11px] text-secondary">
                      Instant discount offered in WhatsApp payment link
                    </span>
                  </div>
                  <div className="flex items-center gap-1 font-mono">
                    <span className="text-secondary">₹</span>
                    <input
                      type="number"
                      value={settings.nudgeDiscountAmount}
                      onChange={(e) => setSettings({
                        ...settings,
                        nudgeDiscountAmount: parseFloat(e.target.value) || 0
                      })}
                      className="w-16 p-1 text-sm font-bold border border-neutralBorder rounded text-right bg-white"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-gray-50 rounded-xl border border-neutralBorder flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-primary block">
                      Confirmation Timeout
                    </span>
                    <span className="text-[11px] text-secondary">
                      Hours before unconfirmed COD orders are held
                    </span>
                  </div>
                  <div className="flex items-center gap-1 font-mono">
                    <input
                      type="number"
                      value={settings.autoCancelTimeoutHours}
                      onChange={(e) => setSettings({
                        ...settings,
                        autoCancelTimeoutHours: parseInt(e.target.value) || 24
                      })}
                      className="w-16 p-1 text-sm font-bold border border-neutralBorder rounded text-right bg-white"
                    />
                    <span className="text-secondary text-xs">hrs</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Unit Economics & Reverse Logistics Parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-500" />
              Reverse Logistics Economics & Cost Model
            </CardTitle>
            <CardDescription>
              Financial constants used to calculate exact rupee savings, net margins, and break-even points
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              <div>
                <label className="text-[11px] font-semibold text-secondary uppercase block mb-1">
                  Average Order Value (AOV)
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-secondary text-xs">₹</span>
                  <input
                    type="number"
                    value={econ.aov}
                    onChange={(e) => setSettings({
                      ...settings,
                      economics: { ...econ, aov: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full text-xs font-semibold p-2 border border-neutralBorder rounded-lg bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-secondary uppercase block mb-1">
                  Gross Margin %
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    value={econ.grossMarginPct}
                    onChange={(e) => setSettings({
                      ...settings,
                      economics: { ...econ, grossMarginPct: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full text-xs font-semibold p-2 border border-neutralBorder rounded-lg bg-white"
                  />
                  <span className="text-secondary text-xs">%</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-secondary uppercase block mb-1">
                  Forward Shipping
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-secondary text-xs">₹</span>
                  <input
                    type="number"
                    value={econ.forwardShipping}
                    onChange={(e) => setSettings({
                      ...settings,
                      economics: { ...econ, forwardShipping: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full text-xs font-semibold p-2 border border-neutralBorder rounded-lg bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-secondary uppercase block mb-1">
                  Return Shipping
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-secondary text-xs">₹</span>
                  <input
                    type="number"
                    value={econ.returnShipping}
                    onChange={(e) => setSettings({
                      ...settings,
                      economics: { ...econ, returnShipping: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full text-xs font-semibold p-2 border border-neutralBorder rounded-lg bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-secondary uppercase block mb-1">
                  Packaging & Handling
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-secondary text-xs">₹</span>
                  <input
                    type="number"
                    value={econ.packagingHandling}
                    onChange={(e) => setSettings({
                      ...settings,
                      economics: { ...econ, packagingHandling: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full text-xs font-semibold p-2 border border-neutralBorder rounded-lg bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-secondary uppercase block mb-1">
                  Average Product Cost
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-secondary text-xs">₹</span>
                  <input
                    type="number"
                    value={econ.avgProductCost}
                    onChange={(e) => setSettings({
                      ...settings,
                      economics: { ...econ, avgProductCost: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full text-xs font-semibold p-2 border border-neutralBorder rounded-lg bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-secondary uppercase block mb-1">
                  Damage Probability
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    value={econ.damageProbability}
                    onChange={(e) => setSettings({
                      ...settings,
                      economics: { ...econ, damageProbability: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full text-xs font-semibold p-2 border border-neutralBorder rounded-lg bg-white"
                  />
                  <span className="text-secondary text-xs">%</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-secondary uppercase block mb-1">
                  New Customer CAC
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-secondary text-xs">₹</span>
                  <input
                    type="number"
                    value={econ.cacNewCustomer}
                    onChange={(e) => setSettings({
                      ...settings,
                      economics: { ...econ, cacNewCustomer: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full text-xs font-semibold p-2 border border-neutralBorder rounded-lg bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Real-time Computed Summary */}
            <div className="p-4 bg-gray-50 rounded-xl border border-neutralBorder flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-secondary uppercase block">
                  Dynamically Calculated Logistics Loss per RTO:
                </span>
                <span className="text-xs text-secondary">
                  ₹{econ.forwardShipping} forward + ₹{econ.returnShipping} return + ₹{econ.packagingHandling} pack + ({econ.damageProbability*100}% × ₹{econ.avgProductCost} damage)
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold font-mono text-rose-600 block">
                  {formatCurrency(calculatedRtoCost)}
                </span>
                <span className="text-[11px] font-medium text-emerald-700">
                  Delivered Margin: {formatCurrency(calculatedGrossProfit)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="outline" onClick={loadSettings} disabled={saving}>
            <RotateCcw className="w-4 h-4 mr-1.5" /> Reset Defaults
          </Button>
          <Button onClick={handleSave} isLoading={saving} className="px-6 gap-2">
            <Save className="w-4 h-4" /> Save Business Configuration
          </Button>
        </div>
      </main>
    </div>
  );
}

