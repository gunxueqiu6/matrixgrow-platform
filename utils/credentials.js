/**
 * Credentials Manager - 凭证加解密工具
 * 使用 AES-256-GCM 加密用户敏感数据
 * 密钥从 JWT_SECRET 派生
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * 从 JWT_SECRET 派生加密密钥
 */
function deriveKey(secret) {
  const effectiveSecret = secret || process.env.JWT_SECRET || 'default-secret-change-me';
  return crypto.createHash('sha256').update(effectiveSecret).digest();
}

/**
 * 加密凭证
 * @param {Object|string} plaintext - 要加密的数据（对象或字符串）
 * @param {string} secret - 加密密钥（可选，默认从环境变量获取）
 * @returns {string} 加密后的字符串，格式: iv:authTag:ciphertext (hex编码)
 */
function encrypt(plaintext, secret = null) {
  const key = deriveKey(secret);

  // 生成随机 IV
  const iv = crypto.randomBytes(IV_LENGTH);

  // 创建 cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // 加密数据
  const data = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // 获取 auth tag
  const authTag = cipher.getAuthTag();

  // 组合: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * 解密凭证
 * @param {string} encryptedData - 加密的字符串，格式: iv:authTag:ciphertext
 * @param {string} secret - 解密密钥（可选，默认从环境变量获取）
 * @param {boolean} parseJson - 是否解析为 JSON 对象
 * @returns {Object|string} 解密后的数据
 */
function decrypt(encryptedData, secret = null, parseJson = true) {
  const key = deriveKey(secret);

  // 解析格式
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const [ivHex, authTagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  // 创建 decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // 解密
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  // 尝试解析 JSON
  if (parseJson) {
    try {
      return JSON.parse(decrypted);
    } catch {
      // 不是 JSON，返回原字符串
      return decrypted;
    }
  }

  return decrypted;
}

/**
 * 加密凭证并存储（用于数据库存储）
 * @param {Object} credentials - 凭证对象
 * @returns {string} 加密后的字符串
 */
function encryptCredentials(credentials) {
  return encrypt(credentials);
}

/**
 * 解密凭证（用于使用时）
 * @param {string} encryptedCredentials - 加密的凭证字符串
 * @returns {Object} 解密后的凭证对象
 */
function decryptCredentials(encryptedCredentials) {
  return decrypt(encryptedCredentials, null, true);
}

module.exports = {
  encrypt,
  decrypt,
  encryptCredentials,
  decryptCredentials,
  deriveKey
};
