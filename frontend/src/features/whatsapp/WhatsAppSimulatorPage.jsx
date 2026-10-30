import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useOutletContext, Link } from 'react-router-dom';
import {
  Search, Send, FastForward, RotateCcw, CheckCheck, Clock,
  Package, User, MapPin, IndianRupee, Loader2, MessageSquare,
  Wifi, Battery, Signal, Sparkles, CheckCircle2, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DecisionBadge, RiskTierBadge } from '../../components/ui/Badge';
import { Header } from '../../components/layout/Header';
import { cn, formatCurrency, formatDate } from '../../lib/utils';
import { whatsappApi, ordersApi } from '../../services/api';

// ── Status Badge ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    AWAITING_REPLY: { label: 'Awaiting Customer Reply', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
    CONFIRMED: { label: 'Confirmed ✓ Dispatch Ready', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    CANCELLED: { label: 'Cancelled (RTO Saved)', cls: 'bg-rose-100 text-rose-800 border-rose-300' },
    EXPIRED: { label: 'Expired (24h Timeout - Held)', cls: 'bg-gray-100 text-gray-700 border-gray-300' },
    CONVERTED_PREPAID: { label: 'Converted to Prepaid ✓ (₹20 Saved)', cls: 'bg-purple-100 text-purple-800 border-purple-300' },
    ADDRESS_UPDATED: { label: 'Address Updated ✓', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
    PENDING: { label: 'Pending Dispatch', cls: 'bg-gray-100 text-gray-700 border-gray-300' },
  };
  const item = map[status] || map.PENDING;
  return (
    <span className={cn('inline-block px-3 py-1 rounded-full text-xs font-semibold border shadow-2xs', item.cls)}>
      {item.label}
    </span>
  );
}

// ── Chat Bubble ─────────────────────────────────────────────────────────────
function ChatBubble({ message, onActionClick }) {
  const isBot = message.sender === 'BOT' || message.sender === 'bot';
  const isSystem = message.sender === 'SYSTEM' || message.sender === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <span className="text-[11px] text-gray-600 bg-black/10 backdrop-blur-xs px-3.5 py-1.5 rounded-full font-medium shadow-2xs">
          {message.content || message.message || message.text}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex mb-3', isBot ? 'justify-start' : 'justify-end')}
    >
      <div className={cn(
        'max-w-[85%] rounded-2xl px-4 py-3 shadow-xs relative',
        isBot
          ? 'bg-white rounded-tl-xs text-gray-900 border border-gray-100'
          : 'bg-[#DCF8C6] rounded-tr-xs text-gray-900'
      )}>
        <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
          {message.content || message.message || message.text}
        </p>

        <div className={cn('flex items-center gap-1 mt-1.5', isBot ? 'justify-start' : 'justify-end')}>
          <span className="text-[10px] text-gray-400 font-mono">
            {message.timestamp ? formatDate(message.timestamp) : ''}
          </span>
          {!isBot && <CheckCheck className="w-3.5 h-3.5 text-blue-500" />}
        </div>

        {/* Action button chips in bot message */}
        {isBot && message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2.5 pt-2 border-t border-gray-100">
            {message.actions.map((action, i) => {
              const label = typeof action === 'string' ? action : action.label || action.value;
              const val = typeof action === 'string' ? action : action.value || action.label;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onActionClick && onActionClick(val)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#128C7E] text-white hover:bg-[#075E54] active:scale-95 transition-all shadow-xs cursor-pointer"
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export function WhatsAppSimulatorPage() {
  const { onToggleMobileMenu } = useOutletContext() || {};
  const [searchParams, setSearchParams] = useSearchParams();

  const [orderIdInput, setOrderIdInput] = useState(searchParams.get('orderId') || '');
  const [order, setOrder] = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [workflow, setWorkflow] = useState('ORDER_CONFIRMATION');
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [fastForwarding, setFastForwarding] = useState(false);
  const [simTime, setSimTime] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const chatEndRef = useRef(null);

  // Auto-load order only if explicitly provided in query params (e.g. redirected from orders page)
  useEffect(() => {
    const id = searchParams.get('orderId');
    if (id) {
      setOrderIdInput(id);
      loadOrder(id);
    } else {
      setOrder(null);
      setConversation(null);
      setMessages([]);
      setOrderIdInput('');
    }
  }, [searchParams]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadOrder = async (id) => {
    const trimmedId = id ? id.trim() : '';
    if (!trimmedId) {
      setSearchError('Please enter an Order ID');
      return;
    }
    setOrderLoading(true);
    setSearchError(null);
    try {
      const data = await ordersApi.getOrderById(trimmedId);
      if (!data) {
        setSearchError(`Order "${trimmedId}" not found. Try KT100437 or KT100529.`);
        setOrder(null);
        setConversation(null);
        setMessages([]);
        return;
      }
      setOrder(data);
      // Determine default workflow based on decision
      const defaultFlow = data?.operationalDecision?.decision === 'NUDGE_TO_PREPAID' 
        ? 'PREPAID_NUDGE' 
        : 'ORDER_CONFIRMATION';
      setWorkflow(defaultFlow);

      // Load existing conversation or auto-trigger initial WhatsApp message if none exists
      try {
        let conv = await whatsappApi.getConversation(trimmedId);
        if (!conv || !conv.messages || conv.messages.length === 0) {
          // Automatically trigger the first outbound message so the simulator shows active context
          conv = await whatsappApi.sendMessage(trimmedId, defaultFlow);
        }
        setConversation(conv);
        setMessages(conv?.messages || []);
        setSimTime(conv?.simulatedCurrentTime || conv?.simulatedTime);
      } catch (convErr) {
        console.warn('Could not auto-fetch conversation, initiating new message:', convErr);
        try {
          const newConv = await whatsappApi.sendMessage(trimmedId, defaultFlow);
          setConversation(newConv);
          setMessages(newConv?.messages || []);
          setSimTime(newConv?.simulatedCurrentTime || newConv?.simulatedTime);
        } catch {
          setConversation(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to load order:', err);
      setSearchError(`Order "${trimmedId}" not found. Verify the Order ID.`);
      setOrder(null);
      setConversation(null);
      setMessages([]);
    } finally {
      setOrderLoading(false);
    }
  };

  const handleTriggerMessage = async () => {
    if (!order) return;
    setTriggering(true);
    try {
      const conv = await whatsappApi.sendMessage(order.orderId, workflow);
      setConversation(conv);
      setMessages(conv?.messages || []);
      setSimTime(conv?.simulatedCurrentTime || conv?.simulatedTime);
    } catch (err) {
      console.error('Failed to send WhatsApp message:', err);
      alert('Failed to send: ' + err.message);
    } finally {
      setTriggering(false);
    }
  };

  const handleSendReply = async (explicitText = null) => {
    const textToSend = explicitText || replyText;
    if (!textToSend.trim() || !order) return;
    setSending(true);
    if (!explicitText) setReplyText('');
    try {
      const conv = await whatsappApi.reply(order.orderId, textToSend.trim());
      setConversation(conv);
      setMessages(conv?.messages || []);
      setSimTime(conv?.simulatedCurrentTime || conv?.simulatedTime);
      // Reload order status
      const updatedOrder = await ordersApi.getOrderById(order.orderId);
      setOrder(updatedOrder);
    } catch (err) {
      console.error('Reply failed:', err);
    } finally {
      setSending(false);
    }
  };

  const handleFastForward = async () => {
    if (!order) return;
    setFastForwarding(true);
    try {
      const res = await whatsappApi.fastForward(order.orderId, 24);
      setConversation(res);
      setMessages(res?.messages || []);
      setSimTime(res?.simulatedCurrentTime || res?.simulatedTime);
      // Reload order status
      const updatedOrder = await ordersApi.getOrderById(order.orderId);
      setOrder(updatedOrder);
    } catch (err) {
      console.error('Fast-forward failed:', err);
    } finally {
      setFastForwarding(false);
    }
  };

  const handleResetClock = async () => {
    try {
      const res = await whatsappApi.resetClock();
      setSimTime(res?.simulatedCurrentTime);
      // Reload conversation
      if (order) loadOrder(order.orderId);
    } catch (err) {
      console.error('Reset failed:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <Header
        title="Interactive WhatsApp Simulator"
        subtitle="Simulate end-to-end customer confirmation, prepaid conversion, and 24-hour timeout flows."
        onToggleMobileMenu={onToggleMobileMenu}
      />

      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* Quick Sample Order Pills */}
        <div className="mb-6 p-4 bg-white rounded-xl border border-neutralBorder flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-secondary">
            <Sparkles className="w-4 h-4 text-primary-accent" />
            <span>Select Sample Order to Test:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'KT100437', label: 'KT100437 (Mumbai - Confirmation Needed)' },
              { id: 'KT100529', label: 'KT100529 (Patna - Prepaid Nudge ₹20 Off)' },
              { id: 'KT100442', label: 'KT100442 (Jaipur - High Risk Critical)' },
              { id: 'KT100193', label: 'KT100193 (Chennai - Low Risk Dispatch)' },
            ].map(sample => (
              <button
                key={sample.id}
                onClick={() => {
                  setOrderIdInput(sample.id);
                  loadOrder(sample.id);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                  order?.orderId === sample.id
                    ? 'bg-primary-accent text-white border-primary-accent shadow-xs'
                    : 'bg-gray-50 text-secondary hover:text-primary border-neutralBorder hover:bg-gray-100'
                }`}
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── LEFT: Control & Order Context Panel ── */}
          <div className="lg:col-span-5 space-y-5">
            {/* Order Selector */}
            <Card>
              <CardHeader>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary-accent" /> Order Context
                  </CardTitle>
                  <CardDescription>Order linked to simulated customer phone</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-2">
                  <input
                    value={orderIdInput}
                    onChange={(e) => {
                      setOrderIdInput(e.target.value);
                      if (searchError) setSearchError(null);
                    }}
                    placeholder="Enter Order ID (e.g. KT100437)…"
                    className="flex-1 text-xs rounded-lg border border-neutralBorder px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-accent/30 font-mono"
                    onKeyDown={(e) => e.key === 'Enter' && loadOrder(orderIdInput)}
                  />
                  <Button variant="primary" size="sm" isLoading={orderLoading} onClick={() => loadOrder(orderIdInput)}>
                    {!orderLoading && <Search className="w-3.5 h-3.5 mr-1" />}
                    Load
                  </Button>
                </div>

                {searchError && (
                  <p className="text-xs text-rose-600 mb-3 font-medium flex items-center gap-1">
                    <span>⚠</span> {searchError}
                  </p>
                )}

                {order && (
                  <div className="p-3.5 rounded-xl bg-gray-50 border border-neutralBorder space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-primary text-sm">{order.orderId}</span>
                      <DecisionBadge decision={order.operationalDecision?.decision} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-secondary">
                      <div>
                        <span className="block text-[10px] uppercase font-semibold text-secondary/80">Customer</span>
                        <span className="font-semibold text-primary">{order.customer?.name}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-semibold text-secondary/80">Amount</span>
                        <span className="font-bold font-mono text-primary">{formatCurrency(order.orderValue)} ({order.paymentMethod})</span>
                      </div>
                      <div className="col-span-2">
                        <span className="block text-[10px] uppercase font-semibold text-secondary/80">Delivery Address</span>
                        <span className="text-primary font-medium">{order.shipping?.address}, {order.shipping?.city}</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-neutralBorder/60 flex items-center justify-between">
                      <span className="text-secondary">Current Status:</span>
                      <span className="font-semibold text-primary px-2 py-0.5 rounded bg-white border border-neutralBorder">
                        {order.operationalDecision?.status || 'PENDING'}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Workflow Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xs uppercase tracking-wider font-bold">
                  Select Workflow Type
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2.5">
                {[
                  { 
                    value: 'ORDER_CONFIRMATION', 
                    label: 'Order Confirmation Flow', 
                    desc: 'Prompt customer to verify COD intent or correct vague address' 
                  },
                  { 
                    value: 'PREPAID_NUDGE', 
                    label: 'Prepaid Nudge Flow (₹20 Instant Discount)', 
                    desc: 'Incentivize online payment link to eliminate 100% of COD refusal risk' 
                  },
                ].map((w) => (
                  <label 
                    key={w.value} 
                    className={cn(
                      'flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all',
                      workflow === w.value ? 'border-primary-accent bg-indigo-50/50 shadow-2xs' : 'border-neutralBorder hover:bg-gray-50'
                    )}
                  >
                    <input
                      type="radio"
                      name="workflow"
                      value={w.value}
                      checked={workflow === w.value}
                      onChange={(e) => setWorkflow(e.target.value)}
                      className="accent-primary-accent mt-0.5"
                    />
                    <div>
                      <div className="text-xs font-bold text-primary">{w.label}</div>
                      <div className="text-[11px] text-secondary mt-0.5 leading-relaxed">{w.desc}</div>
                    </div>
                  </label>
                ))}
              </CardContent>
            </Card>

            {/* Test Clock Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xs uppercase tracking-wider font-bold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-primary-accent" /> Test Clock & Fast-Forward
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {simTime && (
                  <div className="text-xs text-secondary bg-gray-50 rounded-lg p-2.5 border border-neutralBorder flex items-center justify-between">
                    <span className="font-semibold">Simulated Clock:</span>
                    <span className="font-mono font-bold text-primary">{formatDate(simTime)}</span>
                  </div>
                )}
                <Button
                  variant="primary"
                  size="md"
                  isLoading={triggering}
                  disabled={!order}
                  onClick={handleTriggerMessage}
                  className="w-full gap-2"
                >
                  {!triggering && <MessageSquare className="w-4 h-4" />}
                  Trigger WhatsApp Message
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    isLoading={fastForwarding}
                    disabled={!conversation}
                    onClick={handleFastForward}
                    className="gap-1.5 text-xs"
                    title="Simulate 24 hours passing without customer response"
                  >
                    {!fastForwarding && <FastForward className="w-3.5 h-3.5" />}
                    Fast-Forward 24h
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!order}
                    onClick={handleResetClock}
                    className="gap-1.5 text-xs"
                    title="Reset clock to current real time"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset Clock
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── RIGHT: Realistic WhatsApp Phone Mockup ── */}
          <div className="lg:col-span-7 flex flex-col rounded-2xl overflow-hidden border border-gray-300 shadow-xl bg-white min-h-[640px]">
            {/* Phone Top Speaker/Sensor Bar */}
            <div className="bg-[#075E54] text-white/80 px-4 py-1.5 flex items-center justify-between text-[11px] shrink-0 font-medium">
              <span>9:41</span>
              <div className="flex items-center gap-2">
                <Signal className="w-3 h-3" />
                <Wifi className="w-3 h-3" />
                <Battery className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* WhatsApp Contact Header */}
            <div className="bg-[#128C7E] text-white px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-white shrink-0">
                VL
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">
                  VelvetLocks Haircare Support
                </div>
                <div className="text-[11px] text-white/80 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 inline-block" />
                  <span>Verified Business Account · Online</span>
                </div>
              </div>
            </div>

            {/* Chat Conversation Area */}
            <div
              className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[400px] max-h-[480px]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23128C7E' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                backgroundColor: '#E5DDD5',
              }}
            >
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-16 px-4">
                  <div className="w-16 h-16 rounded-full bg-[#128C7E]/10 flex items-center justify-center mb-3">
                    <MessageSquare className="w-8 h-8 text-[#128C7E]" />
                  </div>
                  <p className="text-sm font-semibold text-gray-800">
                    {!order ? 'Select an order to start simulation' : 'No active messages'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs leading-relaxed">
                    {!order ? (
                      'Search by Order ID on the left, or choose one of the sample order buttons above to load its WhatsApp interactive conversation.'
                    ) : (
                      'Click "Trigger WhatsApp Message" on the left to initiate the automated confirmation or nudge flow.'
                    )}
                  </p>
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <ChatBubble 
                    key={msg.id || i} 
                    message={msg} 
                    onActionClick={(val) => handleSendReply(val)}
                  />
                ))}
              </AnimatePresence>
              <div ref={chatEndRef} />
            </div>

            {/* Live Conversation Status Header */}
            {conversation?.status && (
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-b border-gray-200">
                <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider">Conversation State</span>
                <StatusBadge status={conversation.status} />
              </div>
            )}

            {/* Quick-Reply One-Click Buttons */}
            {conversation && (
              <div className="px-3 py-2 bg-gray-100/80 border-t border-gray-200 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[10px] font-semibold text-secondary uppercase mr-1">1-Click Test Replies:</span>
                <button
                  type="button"
                  onClick={() => handleSendReply('YES')}
                  className="px-2.5 py-1 rounded-md bg-white border border-gray-300 text-gray-800 font-medium hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-800 transition-colors"
                >
                  ✅ Confirm (YES)
                </button>
                <button
                  type="button"
                  onClick={() => handleSendReply('CANCEL')}
                  className="px-2.5 py-1 rounded-md bg-white border border-gray-300 text-gray-800 font-medium hover:bg-rose-50 hover:border-rose-400 hover:text-rose-800 transition-colors"
                >
                  ❌ Cancel (NO)
                </button>
                <button
                  type="button"
                  onClick={() => handleSendReply('PAID')}
                  className="px-2.5 py-1 rounded-md bg-white border border-gray-300 text-gray-800 font-medium hover:bg-purple-50 hover:border-purple-400 hover:text-purple-800 transition-colors"
                >
                  ⚡ Online Paid (PAID)
                </button>
                <button
                  type="button"
                  onClick={() => handleSendReply('Flat 402, Green Avenue, Mumbai 400050')}
                  className="px-2.5 py-1 rounded-md bg-white border border-gray-300 text-gray-800 font-medium hover:bg-blue-50 hover:border-blue-400 hover:text-blue-800 transition-colors"
                >
                  📍 Update Address
                </button>
              </div>
            )}

            {   /* Text Input Footer Bar */}
            <div className="bg-white p-3 border-t border-gray-200 flex items-center gap-2">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type customer reply (e.g. YES, CANCEL, PAID, or address)..."
                className="flex-1 text-xs sm:text-sm bg-gray-100 rounded-full px-4 py-2.5 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#128C7E]/40 border border-transparent focus:border-[#128C7E] transition-all"
                onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                disabled={!conversation || sending}
              />
              <button
                onClick={() => handleSendReply()}
                disabled={!replyText.trim() || !conversation || sending}
                className="w-10 h-10 rounded-full bg-[#128C7E] text-white flex items-center justify-center hover:bg-[#075E54] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-xs"
                title="Send reply"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
