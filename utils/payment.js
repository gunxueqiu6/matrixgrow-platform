/**
 * Payment Module - 支付处理模块
 * 支持 PayPal、微信支付、支付宝
 */

const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');

class PaymentService {
  constructor(options = {}) {
    this.db = options.db;
    this.config = options.config || {};
    
    this.paypalConfig = {
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET,
      apiUrl: process.env.PAYPAL_API_URL || 'https://api-m.sandbox.paypal.com'
    };
    
    this.wechatConfig = {
      appId: process.env.WECHAT_APP_ID,
      mchId: process.env.WECHAT_MCH_ID,
      mchKey: process.env.WECHAT_MCH_KEY,
      notifyUrl: process.env.WECHAT_NOTIFY_URL,
      apiUrl: 'https://api.mch.weixin.qq.com'
    };
    
    this.alipayConfig = {
      appId: process.env.ALIPAY_APP_ID,
      privateKey: process.env.ALIPAY_PRIVATE_KEY,
      publicKey: process.env.ALIPAY_PUBLIC_KEY,
      notifyUrl: process.env.ALIPAY_NOTIFY_URL,
      returnUrl: process.env.ALIPAY_RETURN_URL,
      apiUrl: process.env.ALIPAY_API_URL || 'https://openapi.alipaydev.com/gateway.do'
    };
  }

  /**
   * 创建支付订单
   */
  async createOrder(userId, channel, tier) {
    const tierConfig = this.getTierConfig(tier);
    if (!tierConfig) {
      throw new Error(`无效的套餐: ${tier}`);
    }

    const { orderNo } = await this.db.createPaymentOrder(
      userId,
      channel,
      tierConfig.price,
      tier,
      tierConfig.currency
    );

    return { orderNo, ...tierConfig };
  }

  /**
   * 获取套餐配置
   */
  getTierConfig(tier) {
    const tiers = {
      pro: { price: 99, currency: 'CNY', duration: 30, name: 'Pro 版' },
      promax: { price: 299, currency: 'CNY', duration: 90, name: 'Pro Max 版' }
    };
    return tiers[tier] || null;
  }

  /**
   * 获取支付链接（PayPal）
   */
  async getPayPalPaymentUrl(orderNo) {
    const order = await this.db.getPaymentOrder(orderNo);
    if (!order) throw new Error('订单不存在');

    // 获取 Access Token
    const token = await this.getPayPalAccessToken();
    
    // 创建 PayPal 订单
    const response = await axios.post(
      `${this.paypalConfig.apiUrl}/v1/payments/payment`,
      {
        intent: 'sale',
        payer: { payment_method: 'paypal' },
        transactions: [{
          amount: {
            total: order.amount.toFixed(2),
            currency: order.currency
          },
          description: `MatrixGrow ${order.tier} 订阅`
        }],
        redirect_urls: {
          return_url: `${this.config.baseUrl}/api/payment/paypal/callback`,
          cancel_url: `${this.config.baseUrl}/api/payment/paypal/cancel`
        }
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const approvalUrl = response.data.links.find(l => l.rel === 'approval_url')?.href;
    if (!approvalUrl) throw new Error('创建 PayPal 订单失败');

    return approvalUrl;
  }

  /**
   * 获取 PayPal Access Token
   */
  async getPayPalAccessToken() {
    const auth = Buffer.from(`${this.paypalConfig.clientId}:${this.paypalConfig.clientSecret}`).toString('base64');
    const response = await axios.post(
      `${this.paypalConfig.apiUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    return response.data.access_token;
  }

  /**
   * PayPal 回调处理
   */
  async handlePayPalCallback(paymentId, payerId) {
    const token = await this.getPayPalAccessToken();
    
    const response = await axios.post(
      `${this.paypalConfig.apiUrl}/v1/payments/payment/${paymentId}/execute`,
      { payer_id: payerId },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const payment = response.data;
    if (payment.state === 'approved') {
      // 根据需要提取订单号并更新状态
      return { success: true, transactionId: payment.id };
    }
    
    return { success: false, error: '支付未完成' };
  }

  /**
   * 获取微信支付参数（Native 支付）
   */
  async getWechatPaymentParams(orderNo) {
    const order = await this.db.getPaymentOrder(orderNo);
    if (!order) throw new Error('订单不存在');

    const params = {
      appid: this.wechatConfig.appId,
      mch_id: this.wechatConfig.mchId,
      nonce_str: this.generateNonceStr(),
      body: `MatrixGrow ${order.tier} 订阅`,
      out_trade_no: order.order_no,
      total_fee: Math.round(order.amount * 100), // 单位：分
      spbill_create_ip: '127.0.0.1',
      notify_url: this.wechatConfig.notifyUrl,
      trade_type: 'NATIVE'
    };

    params.sign = this.wechatSign(params);

    const response = await axios.post(
      `${this.wechatConfig.apiUrl}/pay/unifiedorder`,
      this.buildXml(params),
      { headers: { 'Content-Type': 'application/xml' } }
    );

    const result = this.parseXml(response.data);
    if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
      return { codeUrl: result.code_url };
    }

    throw new Error(result.err_code_des || '微信支付下单失败');
  }

  /**
   * 微信支付回调处理
   */
  async handleWechatCallback(xmlData) {
    const params = this.parseXml(xmlData);
    
    // 验证签名
    if (!this.wechatSignVerify(params)) {
      return this.buildWechatResponse(false, '签名错误');
    }

    if (params.return_code === 'SUCCESS' && params.result_code === 'SUCCESS') {
      const orderNo = params.out_trade_no;
      const transactionId = params.transaction_id;
      
      await this.db.markOrderPaid(orderNo, transactionId);
      await this.upgradeSubscription(orderNo);
      
      return this.buildWechatResponse(true);
    }

    return this.buildWechatResponse(false, params.err_code_des);
  }

  /**
   * 微信签名
   */
  wechatSign(params) {
    const sorted = Object.keys(params).sort().filter(k => params[k] && k !== 'sign');
    const str = sorted.map(k => `${k}=${params[k]}`).join('&') + `&key=${this.wechatConfig.mchKey}`;
    return crypto.createHash('md5').update(str).digest('hex').toUpperCase();
  }

  /**
   * 微信签名验证
   */
  wechatSignVerify(params) {
    const sign = params.sign;
    const paramsWithoutSign = { ...params };
    delete paramsWithoutSign.sign;
    const calculatedSign = this.wechatSign(paramsWithoutSign);
    return sign === calculatedSign;
  }

  /**
   * 生成随机字符串
   */
  generateNonceStr(length = 32) {
    return crypto.randomBytes(length).toString('hex').substr(0, length);
  }

  /**
   * XML 解析为 JS 对象（简化版）
   */
  parseXml(xml) {
    const result = {};
    const matches = xml.match(/<(\w+)>([^<]+)<\/\w+>/g) || [];
    matches.forEach(match => {
      const key = match.match(/<(\w+)>/)[1];
      const value = match.match(/>([^<]+)</)[1];
      result[key] = value;
    });
    return result;
  }

  /**
   * JS 对象构建为 XML（简化版）
   */
  buildXml(obj) {
    let xml = '<xml>';
    for (const key of Object.keys(obj)) {
      xml += `<${key}>${obj[key]}</${key}>`;
    }
    xml += '</xml>';
    return xml;
  }

  /**
   * 构建微信响应
   */
  buildWechatResponse(success, message = '') {
    return this.buildXml({
      return_code: success ? 'SUCCESS' : 'FAIL',
      return_msg: message || (success ? 'OK' : '失败')
    });
  }

  /**
   * 获取支付宝支付链接
   */
  async getAlipayPaymentUrl(orderNo) {
    const order = await this.db.getPaymentOrder(orderNo);
    if (!order) throw new Error('订单不存在');

    const params = {
      app_id: this.alipayConfig.appId,
      method: 'alipay.trade.page.pay',
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: new Date().toISOString().replace(/[-T:.]/g, '').substr(0, 14),
      version: '1.0',
      notify_url: this.alipayConfig.notifyUrl,
      return_url: this.alipayConfig.returnUrl,
      biz_content: JSON.stringify({
        out_trade_no: order.order_no,
        product_code: 'FAST_INSTANT_TRADE_PAY',
        total_amount: order.amount.toFixed(2),
        subject: `MatrixGrow ${order.tier} 订阅`
      })
    };

    params.sign = this.alipaySign(params);

    return `${this.alipayConfig.apiUrl}?${querystring.stringify(params)}`;
  }

  /**
   * 支付宝签名
   */
  alipaySign(params) {
    const sorted = Object.keys(params).sort().filter(k => params[k]);
    const str = sorted.map(k => `${k}=${params[k]}`).join('&');
    const sign = crypto.createSign('RSA-SHA256').update(str).sign(this.alipayConfig.privateKey, 'base64');
    return sign;
  }

  /**
   * 支付宝回调处理
   */
  async handleAlipayCallback(params) {
    const sign = params.sign;
    const paramsWithoutSign = { ...params };
    delete paramsWithoutSign.sign;
    delete paramsWithoutSign.sign_type;

    // 验证签名（简化实现）
    const sorted = Object.keys(paramsWithoutSign).sort();
    const str = sorted.map(k => `${k}=${paramsWithoutSign[k]}`).join('&');
    const verify = crypto.createVerify('RSA-SHA256').update(str);
    const isValid = verify.verify(this.alipayConfig.publicKey, sign, 'base64');

    if (!isValid) {
      return 'failure';
    }

    if (params.trade_status === 'TRADE_SUCCESS' || params.trade_status === 'TRADE_FINISHED') {
      const orderNo = params.out_trade_no;
      const transactionId = params.trade_no;
      
      await this.db.markOrderPaid(orderNo, transactionId);
      await this.upgradeSubscription(orderNo);
      
      return 'success';
    }

    return 'failure';
  }

  /**
   * 升级订阅
   */
  async upgradeSubscription(orderNo) {
    const order = await this.db.getPaymentOrder(orderNo);
    if (!order || order.status !== 'paid') return;

    const tierConfig = this.getTierConfig(order.tier);
    if (!tierConfig) return;

    // 更新用户订阅
    const expiresAt = new Date(Date.now() + tierConfig.duration * 24 * 60 * 60 * 1000).toISOString();
    
    await this.db.updateSubscription(order.user_id, {
      tier: order.tier,
      expires_at: expiresAt,
      status: 'active'
    });
  }

  /**
   * 获取支付状态
   */
  async getPaymentStatus(orderNo) {
    const order = await this.db.getPaymentOrder(orderNo);
    if (!order) {
      return { status: 'not_found' };
    }

    return {
      status: order.status,
      orderNo: order.order_no,
      tier: order.tier,
      amount: order.amount,
      currency: order.currency,
      createdAt: order.created_at,
      paidAt: order.paid_at
    };
  }
}

module.exports = { PaymentService };
