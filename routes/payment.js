/**
 * Payment Routes - 支付相关 API
 */

const express = require('express');
const { authenticate } = require('../middleware/auth');

function createPaymentRouter(db, paymentService) {
  const router = express.Router();

  // POST /api/payment/create - 创建支付订单
  router.post('/payment/create', authenticate, async (req, res) => {
    try {
      const { channel, tier } = req.body;

      const validChannels = ['paypal', 'wechat', 'alipay'];
      const validTiers = ['pro', 'promax'];
      if (!channel || !tier) {
        return res.status(400).json({ error: '缺少必要参数' });
      }
      if (!validChannels.includes(channel)) {
        return res.status(400).json({ error: `不支持的支付渠道: ${channel}` });
      }
      if (!validTiers.includes(tier)) {
        return res.status(400).json({ error: `无效的套餐: ${tier}` });
      }

      const result = await paymentService.createOrder(req.user.userId, channel, tier);

      res.json({
        success: true,
        orderNo: result.orderNo,
        tier,
        amount: result.price,
        currency: result.currency
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/payment/url - 获取支付链接
  router.get('/payment/url', authenticate, async (req, res) => {
    try {
      const { orderNo, channel } = req.query;

      if (!orderNo || !channel) {
        return res.status(400).json({ error: '缺少必要参数' });
      }

      let url;
      switch (channel) {
        case 'paypal':
          url = await paymentService.getPayPalPaymentUrl(orderNo);
          break;
        case 'wechat':
          const params = await paymentService.getWechatPaymentParams(orderNo);
          return res.json({ success: true, codeUrl: params.codeUrl });
        case 'alipay':
          url = await paymentService.getAlipayPaymentUrl(orderNo);
          break;
        default:
          return res.status(400).json({ error: '不支持的支付渠道' });
      }

      res.json({ success: true, url });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/payment/status - 查询支付状态
  router.get('/payment/status', authenticate, async (req, res) => {
    try {
      const { orderNo } = req.query;

      if (!orderNo) {
        return res.status(400).json({ error: '缺少订单号' });
      }

      const status = await paymentService.getPaymentStatus(orderNo);
      res.json({ success: true, ...status });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/payment/orders - 获取用户支付订单列表
  router.get('/payment/orders', authenticate, async (req, res) => {
    try {
      const orders = await db.getPaymentOrdersByUser(req.user.userId);
      res.json({ success: true, orders });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // PayPal 回调
  router.get('/payment/paypal/callback', async (req, res) => {
    try {
      const { paymentId, PayerID } = req.query;

      if (!paymentId || !PayerID) {
        return res.redirect('/payment/failed');
      }

      const result = await paymentService.handlePayPalCallback(paymentId, PayerID);

      if (result.success) {
        res.redirect('/payment/success');
      } else {
        res.redirect('/payment/failed');
      }
    } catch (error) {
      res.redirect('/payment/failed');
    }
  });

  // PayPal 取消
  router.get('/payment/paypal/cancel', (req, res) => {
    res.redirect('/payment/canceled');
  });

  // 微信支付回调
  router.post('/payment/wechat/callback', async (req, res) => {
    try {
      const xmlData = req.body;
      const response = await paymentService.handleWechatCallback(xmlData);
      res.set('Content-Type', 'application/xml').send(response);
    } catch (error) {
      res.status(500).send('error');
    }
  });

  // 支付宝回调
  router.post('/payment/alipay/callback', async (req, res) => {
    try {
      const result = await paymentService.handleAlipayCallback(req.body);
      res.send(result);
    } catch (error) {
      res.send('failure');
    }
  });

  return router;
}

module.exports = { createPaymentRouter };
