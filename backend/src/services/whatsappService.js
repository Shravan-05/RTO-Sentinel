import { v4 as uuidv4 } from 'uuid';
import { storage } from './storage.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { aiClient } from './aiClient.js';

export class WhatsAppSimulatorService {
  constructor() {
    this.simulatedNow = new Date();
  }

  // Advance test clock by hours
  advanceClock(hours) {
    this.simulatedNow = new Date(this.simulatedNow.getTime() + (hours * 60 * 60 * 1000));
    return this.simulatedNow;
  }

  resetClock() {
    this.simulatedNow = new Date();
    return this.simulatedNow;
  }

  getSimulatedTime() {
    return this.simulatedNow.toISOString();
  }

  async getOrCreateConversation(orderId) {
    let conv = await storage.getConversationByOrderId(orderId);
    if (!conv) {
      const order = await storage.findOrderById(orderId);
      if (!order) throw new Error(`Order ${orderId} not found`);

      conv = {
        id: `conv_${uuidv4().substring(0, 8)}`,
        orderId,
        customerName: order.customer.name,
        customerPhone: order.customer.phone,
        status: 'PENDING_DISPATCH', // 'PENDING_DISPATCH' | 'AWAITING_REPLY' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'CONVERTED_PREPAID'
        workflowType: order.operationalDecision?.decision === 'NUDGE_TO_PREPAID' ? 'PREPAID_NUDGE' : 'ORDER_CONFIRMATION',
        expiresAt: new Date(this.simulatedNow.getTime() + (24 * 60 * 60 * 1000)).toISOString(),
        messages: [],
        createdAt: this.getSimulatedTime()
      };
      await storage.saveConversation(conv);
    }
    return conv;
  }

  async triggerAutomatedMessage(orderId, type = null) {
    const order = await storage.findOrderById(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    const conv = await this.getOrCreateConversation(orderId);
    const flowType = type || (order.operationalDecision?.decision === 'NUDGE_TO_PREPAID' ? 'PREPAID_NUDGE' : 'ORDER_CONFIRMATION');
    conv.workflowType = flowType;

    let botMessageText = '';
    const itemsText = `${order.numItems}x VelvetLocks Hair Serum & Shampoo`;

    if (flowType === 'PREPAID_NUDGE') {
      const discountedVal = Math.max(0, order.orderValue - config.economics.prepaidDiscount);
      botMessageText = 
`Hello ${order.customer.name}! 🌸 Thank you for your VelvetLocks order #${order.orderId} (₹${order.orderValue}).

✨ SPECIAL EXCLUSIVE OFFER:
Pay online now and get an INSTANT ₹${config.economics.prepaidDiscount} DISCOUNT!
Pay only ₹${discountedVal} instead of ₹${order.orderValue}.

👉 Secure Payment Link:
https://pay.rtosentinel.com/v1/checkout?order=${order.orderId}&discount=20

Reply 'PAID' after payment, or reply 'CONFIRM COD' to keep Cash on Delivery at ₹${order.orderValue}.`;
    } else {
      botMessageText = 
`Hi ${order.customer.name}! 👋 Thank you for shopping with VelvetLocks Haircare.

We have received your Cash on Delivery (COD) order #${order.orderId} for ₹${order.orderValue}.
📦 Items: ${itemsText}
📍 Delivery Address: ${order.shipping.address}, ${order.shipping.city} - ${order.shipping.pincode}

To ensure prompt delivery, please reply:
👉 Reply '1' or 'YES' to CONFIRM this order.
👉 Reply '2' or 'CANCEL' if you placed this by mistake.
👉 Reply with your full address if you'd like to update delivery details.`;
    }

    const messageObj = {
      id: `msg_${uuidv4().substring(0, 8)}`,
      sender: 'BOT',
      text: botMessageText,
      timestamp: this.getSimulatedTime(),
      actions: flowType === 'PREPAID_NUDGE' 
        ? [{ label: '⚡ Pay Online (Save ₹20)', value: 'PAID' }, { label: 'Keep COD', value: 'CONFIRM COD' }]
        : [{ label: '✅ Confirm Order', value: 'YES' }, { label: '❌ Cancel Order', value: 'CANCEL' }]
    };

    conv.messages.push(messageObj);
    conv.status = 'AWAITING_REPLY';
    conv.lastSentAt = this.getSimulatedTime();
    conv.expiresAt = new Date(this.simulatedNow.getTime() + (24 * 60 * 60 * 1000)).toISOString();

    await storage.saveConversation(conv);
    await storage.updateOrder(orderId, {
      'whatsapp.status': 'SENT',
      'whatsapp.lastMessageSentAt': this.getSimulatedTime()
    });

    return conv;
  }

  async handleCustomerReply(orderId, rawReply) {
    const order = await storage.findOrderById(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    const conv = await this.getOrCreateConversation(orderId);
    const reply = (rawReply || '').trim();
    const replyLower = reply.toLowerCase();

    // Log customer message
    conv.messages.push({
      id: `msg_${uuidv4().substring(0, 8)}`,
      sender: 'CUSTOMER',
      text: reply,
      timestamp: this.getSimulatedTime()
    });

    let botResponse = '';
    let updatedStatus = conv.status;

    // Check expiration against test clock
    if (new Date(this.simulatedNow) > new Date(conv.expiresAt)) {
      conv.status = 'EXPIRED';
      botResponse = `This confirmation link has expired after 24 hours. Your order has been held for manual verification. Please contact support at support@velvetlocks.com.`;
      conv.messages.push({
        id: `msg_${uuidv4().substring(0, 8)}`,
        sender: 'BOT',
        text: botResponse,
        timestamp: this.getSimulatedTime()
      });
      await storage.saveConversation(conv);
      await storage.updateOrder(orderId, {
        'operationalDecision.status': 'HELD_TIMEOUT',
        'whatsapp.status': 'EXPIRED'
      });
      return conv;
    }

    // Workflow Branching: PREPAID NUDGE
    if (conv.workflowType === 'PREPAID_NUDGE') {
      if (['paid', 'pay', 'completed', 'done', 'online'].includes(replyLower)) {
        updatedStatus = 'CONVERTED_PREPAID';
        botResponse = `🎉 Payment received! ₹${config.economics.prepaidDiscount} discount applied. Your order is now PREPAID and prioritized for immediate dispatch. Tracking link will be sent shortly! 🚀`;
        
        await storage.updateOrder(orderId, {
          paymentMethod: 'PREPAID',
          orderValue: Math.max(0, order.orderValue - config.economics.prepaidDiscount),
          'operationalDecision.decision': 'SHIP_AS_IS',
          'operationalDecision.status': 'DISPATCH_READY',
          'operationalDecision.reason': 'Customer converted to Prepaid via WhatsApp nudge; ₹20 discount granted.',
          'whatsapp.status': 'PREPAID_CONVERTED'
        });
      } else if (['confirm cod', 'cod', 'yes', 'keep cod', '1'].includes(replyLower)) {
        updatedStatus = 'CONFIRMED';
        botResponse = `✅ Understood! Your order will proceed as Cash on Delivery for ₹${order.orderValue}. Courier delivery scheduled within 2-3 business days.`;
        
        await storage.updateOrder(orderId, {
          'operationalDecision.status': 'CONFIRMED_COD',
          'operationalDecision.reason': 'Customer confirmed COD delivery via WhatsApp.',
          'whatsapp.status': 'CONFIRMED'
        });
      } else if (['no', 'cancel', '2'].includes(replyLower)) {
        updatedStatus = 'CANCELLED';
        botResponse = `Order #${order.orderId} has been successfully cancelled as requested. No charges applied. Hope to serve you again soon!`;
        
        await storage.updateOrder(orderId, {
          'operationalDecision.decision': 'HOLD_CANCEL',
          'operationalDecision.status': 'CUSTOMER_CANCELLED',
          'operationalDecision.reason': 'Customer requested cancellation via WhatsApp.',
          'whatsapp.status': 'CANCELLED'
        });
      } else {
        botResponse = `Please reply 'PAID' if you completed online payment, 'CONFIRM COD' to ship via Cash on Delivery, or 'CANCEL' to cancel.`;
      }
    } 
    // Workflow Branching: ORDER CONFIRMATION
    else {
      if (['yes', '1', 'confirm', 'pls ship', 'send', 'ha', 'haa', 'pakka'].includes(replyLower)) {
        updatedStatus = 'CONFIRMED';
        botResponse = `🎉 Thank you! Your order is confirmed and queued for packing. Delivery estimated in 2-3 business days.`;
        
        await storage.updateOrder(orderId, {
          'operationalDecision.status': 'DISPATCH_READY',
          'operationalDecision.reason': 'Verified customer intent via WhatsApp interactive confirmation.',
          'whatsapp.status': 'CONFIRMED',
          'whatsapp.confirmedAt': this.getSimulatedTime()
        });
      } else if (['no', '2', 'cancel', 'nahi', 'mistake', 'dont send'].includes(replyLower)) {
        updatedStatus = 'CANCELLED';
        botResponse = `Understood. Order #${order.orderId} has been cancelled without any penalty or courier dispatch. Have a great day!`;
        
        await storage.updateOrder(orderId, {
          'operationalDecision.decision': 'HOLD_CANCEL',
          'operationalDecision.status': 'CUSTOMER_CANCELLED',
          'operationalDecision.reason': 'Customer responded NO to WhatsApp confirmation prompt. Avoided ₹169.40 RTO loss.',
          'whatsapp.status': 'CANCELLED'
        });
      } else if (reply.length > 15) {
        // Customer provided address correction
        updatedStatus = 'ADDRESS_UPDATED';
        botResponse = `📍 Thank you! We have updated your delivery address to:\n"${reply}".\nOur team is verifying and preparing dispatch!`;
        
        // Re-evaluate address via AI
        const validation = await aiClient.validateAddress({
          address: reply,
          city: order.shipping.city,
          state: order.shipping.state,
          pincode: order.shipping.pincode,
          customer_name: order.customer.name
        });

        await storage.updateOrder(orderId, {
          'shipping.address': reply,
          'operationalDecision.status': validation.is_valid ? 'DISPATCH_READY' : 'PENDING_MANUAL_REVIEW',
          'operationalDecision.reason': `Address updated by customer via WhatsApp (${validation.category}).`,
          'whatsapp.status': 'ADDRESS_UPDATED'
        });
      } else {
        botResponse = `Sorry, I didn't recognize that option. Please reply 'YES' to confirm dispatch, 'CANCEL' to cancel, or send your full updated address.`;
      }
    }

    conv.status = updatedStatus;
    conv.messages.push({
      id: `msg_${uuidv4().substring(0, 8)}`,
      sender: 'BOT',
      text: botResponse,
      timestamp: this.getSimulatedTime()
    });

    await storage.saveConversation(conv);
    return conv;
  }

  async fastForwardHours(orderId, hours = 24) {
    this.advanceClock(hours);
    const conv = await this.getOrCreateConversation(orderId);
    
    if (conv.status === 'AWAITING_REPLY') {
      conv.status = 'EXPIRED';
      conv.messages.push({
        id: `msg_${uuidv4().substring(0, 8)}`,
        sender: 'SYSTEM',
        text: `⏰ [FAST-FORWARD] 24 hours elapsed without customer response. Workflow auto-timed out.`,
        timestamp: this.getSimulatedTime()
      });
      await storage.saveConversation(conv);
      await storage.updateOrder(orderId, {
        'operationalDecision.status': 'HELD_TIMEOUT',
        'operationalDecision.reason': 'Customer failed to confirm order within 24-hour verification window. Held to avoid RTO loss.',
        'whatsapp.status': 'EXPIRED'
      });
    }

    return {
      simulatedNow: this.getSimulatedTime(),
      conversation: conv
    };
  }
}

export const whatsAppService = new WhatsAppSimulatorService();

