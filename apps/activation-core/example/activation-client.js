/**
 * 浏览器环境下的激活客户端
 * 负责与服务端API通信，处理激活码验证和状态检查
 *
 * 防篡改 / 防重放（#45 M15）：
 * - 必须提供服务端 ES256 公钥，缺少时构造直接报错，不会静默跳过验签
 * - 每次 verify / activate 先向服务端申请一次性 challenge；服务端消费后把它写进
 *   license_token 的 nonce。客户端只接受签名有效、且 nonce / device_id / route 与本次请求
 *   一致的响应，截获的旧响应无法重放，也不依赖本地时钟或内存缓存
 * - 本地保存的激活信息取自已验签的 token，而不是未签名的响应正文
 */
class ActivationClient {
    constructor(apiBaseUrl, apiKey, options = {}) {
        if (!options.publicKeyPem) {
            throw new Error('ActivationClient 需要服务端 ES256 公钥（options.publicKeyPem），缺少时拒绝工作');
        }
        this.apiBaseUrl = apiBaseUrl.replace(/\/$/, ''); // 移除末尾斜杠
        this.apiKey = apiKey;
        this.timeout = options.timeout || 30000; // 30秒超时
        this.publicKeyPem = options.publicKeyPem; // ES256 公钥
        this.maxClockSkew = options.maxClockSkew || 90000; // token 过期判断的时钟偏差容忍（毫秒）
        this.publicKeyPromise = null;
    }

    /**
     * 导入 ES256 公钥用于验签
     * @param {string} publicKeyPem PEM 格式的公钥
     * @returns {Promise<CryptoKey>} WebCrypto 公钥对象
     */
    async importPublicKey(publicKeyPem) {
        try {
            // 移除 PEM 头尾和换行符
            const keyData = publicKeyPem
                .replace(/-----BEGIN PUBLIC KEY-----/, '')
                .replace(/-----END PUBLIC KEY-----/, '')
                .replace(/\s/g, '');

            // Base64 解码
            const binaryKey = atob(keyData);
            const keyBytes = new Uint8Array(binaryKey.length);
            for (let i = 0; i < binaryKey.length; i++) {
                keyBytes[i] = binaryKey.charCodeAt(i);
            }

            // 导入为 WebCrypto 密钥
            return await crypto.subtle.importKey(
                'spki',
                keyBytes,
                {
                    name: 'ECDSA',
                    namedCurve: 'P-256'
                },
                false,
                ['verify']
            );
        } catch (error) {
            console.error('公钥导入失败:', error);
            throw new Error('公钥格式无效或不支持');
        }
    }

    getPublicKey() {
        if (!this.publicKeyPromise) {
            this.publicKeyPromise = this.importPublicKey(this.publicKeyPem);
        }
        return this.publicKeyPromise;
    }

    /**
     * 向服务端申请一次性 challenge
     * @param {string} deviceId 设备ID
     * @param {string} route 将要调用的接口
     * @returns {Promise<string>} challenge
     */
    async requestChallenge(deviceId, route) {
        const response = await this.makeRequest('/api/client/challenge', 'POST', { device_id: deviceId, route });
        const result = await response.json();
        if (!result.success || !result.data || typeof result.data.challenge !== 'string') {
            throw new Error(result.message || '获取 challenge 失败');
        }
        return result.data.challenge;
    }

    /**
     * 验证服务端签名，并确认 token 属于本次请求
     * @param {Object} responseData 服务端响应数据
     * @param {string} route API 路径
     * @param {string} deviceId 本次请求的设备ID
     * @param {string} challenge 本次请求使用的 challenge
     * @returns {Promise<Object|null>} 验签通过返回 token 载荷，否则 null
     */
    async verifyServerSignature(responseData, route, deviceId, challenge) {
        try {
            const { license_token } = responseData.data || {};
            if (typeof license_token !== 'string') {
                console.error('响应缺少 license_token');
                return null;
            }

            const parts = license_token.split('.');
            if (parts.length !== 3) {
                console.error('License token 格式错误');
                return null;
            }

            const header = JSON.parse(this.base64urlDecodeToString(parts[0]));
            if (header.alg !== 'ES256') {
                console.error('License token 算法不匹配:', header.alg);
                return null;
            }

            // 先验签，验签通过后才信任载荷
            const isValid = await crypto.subtle.verify(
                { name: 'ECDSA', hash: 'SHA-256' },
                await this.getPublicKey(),
                this.base64urlToArrayBuffer(parts[2]),
                new TextEncoder().encode(parts[0] + '.' + parts[1])
            );
            if (!isValid) {
                console.error('❌ 服务端响应签名验证失败');
                return null;
            }

            const payload = JSON.parse(this.base64urlDecodeToString(parts[1]));

            // 防重放：nonce 必须是本次申请并提交的 challenge
            if (payload.nonce !== challenge) {
                console.error('License token 不属于本次请求（nonce 不匹配），疑似重放');
                return null;
            }
            if (payload.route !== route) {
                console.error('License token route 不匹配:', { expected: route, actual: payload.route });
                return null;
            }
            if (payload.device_id !== deviceId) {
                console.error('License token 设备不匹配');
                return null;
            }
            if (payload.is_activated !== true) {
                console.error('License token 未声明激活');
                return null;
            }
            if (typeof payload.exp !== 'number' || payload.exp * 1000 + this.maxClockSkew < Date.now()) {
                console.error('License token 已过期');
                return null;
            }

            console.log('✅ 服务端响应签名验证通过');
            return payload;
        } catch (error) {
            console.error('签名验证过程出错:', error);
            return null;
        }
    }

    base64urlDecodeToString(base64url) {
        return new TextDecoder().decode(this.base64urlToArrayBuffer(base64url));
    }

    /**
     * Base64URL 解码为 ArrayBuffer
     * @param {string} base64url Base64URL 编码字符串
     * @returns {ArrayBuffer} 解码后的二进制数据
     */
    base64urlToArrayBuffer(base64url) {
        // 转换为标准 Base64
        const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);

        // 解码
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * 激活设备
     * @param {string} deviceId 设备ID
     * @param {string} activationCode 激活码
     * @returns {Promise<Object>} 激活结果
     */
    async activate(deviceId, activationCode) {
        const route = '/api/client/activate';
        try {
            console.log(`开始激活设备: ${deviceId}`);

            const challenge = await this.requestChallenge(deviceId, route);
            const response = await this.makeRequest(route, 'POST', {
                device_id: deviceId,
                code: activationCode,
                challenge
            });
            const result = await response.json();

            console.log(`激活API响应:`, result);

            if (result.success && result.data) {
                const claims = await this.verifyServerSignature(result, route, deviceId, challenge);
                if (!claims) {
                    console.error('⚠️ 服务端响应签名验证失败，拒绝激活');
                    return {
                        success: false,
                        message: '服务端响应验证失败，请检查网络安全'
                    };
                }

                // 激活成功，保存已验签的激活信息
                this.saveActivationStatus(deviceId, claims);
                console.log('激活状态已保存到本地');
            }

            return result;
        } catch (error) {
            console.error('激活请求失败:', error);
            return {
                success: false,
                message: this.getErrorMessage(error)
            };
        }
    }

    /**
     * 验证设备激活状态
     * @param {string} deviceId 设备ID
     * @returns {Promise<Object>} 验证结果
     */
    async verify(deviceId) {
        const route = '/api/client/verify';
        try {
            console.log(`开始验证设备激活状态: ${deviceId}`);

            const challenge = await this.requestChallenge(deviceId, route);
            const response = await this.makeRequest(route, 'POST', { device_id: deviceId, challenge });
            const result = await response.json();

            console.log(`验证API响应:`, result);

            if (result.success && result.data) {
                if (result.data.is_activated) {
                    // 声明“已激活”必须带有本次请求的有效签名，否则一律按失败处理
                    const claims = await this.verifyServerSignature(result, route, deviceId, challenge);
                    if (!claims) {
                        console.error('⚠️ 服务端响应签名验证失败，清除本地状态');
                        this.clearActivationStatus(deviceId);
                        return {
                            success: false,
                            message: '服务端响应验证失败，请重新激活',
                            data: {
                                device_id: deviceId,
                                is_activated: false,
                                verified_at: new Date().toISOString(),
                                signature_failed: true
                            }
                        };
                    }
                    this.saveActivationStatus(deviceId, claims);
                } else {
                    this.clearActivationStatus(deviceId);
                }
            }

            return result;
        } catch (error) {
            console.error('验证请求失败:', error);

            // 网络异常时，尝试使用本地缓存状态
            const localStatus = this.getLocalActivationStatus(deviceId);
            return {
                success: false,
                message: this.getErrorMessage(error),
                data: {
                    device_id: deviceId,
                    is_activated: localStatus ? this.isLocalStatusValid(localStatus) : false,
                    verified_at: new Date().toISOString(),
                    local_cache: true
                }
            };
        }
    }

    /**
     * 发送HTTP请求
     * @param {string} endpoint API端点
     * @param {string} method HTTP方法
     * @param {Object} data 请求数据
     * @returns {Promise<Response>} 响应对象
     */
    async makeRequest(endpoint, method = 'GET', data = null) {
        const url = `${this.apiBaseUrl}${endpoint}`;

        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey,
                'User-Agent': 'ActivationClient-Web/2.0'
            }
        };

        // 设置超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        options.signal = controller.signal;

        if (data && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * 保存激活状态到本地存储
     * @param {string} deviceId 设备ID
     * @param {Object} data 激活数据
     */
    saveActivationStatus(deviceId, data) {
        try {
            const status = {
                deviceId: deviceId,
                activatedAt: data.activated_at,
                expiresAt: data.expires_at,
                savedAt: new Date().toISOString(),
                signatureVerified: true // 只有验签通过的 token 才会写入本地
            };

            const key = `activation_${deviceId}`;
            localStorage.setItem(key, JSON.stringify(status));
            console.log('激活状态已保存到localStorage');
        } catch (error) {
            console.warn('保存激活状态失败:', error);
        }
    }

    /**
     * 获取本地激活状态
     * @param {string} deviceId 设备ID
     * @returns {Object|null} 本地激活状态
     */
    getLocalActivationStatus(deviceId) {
        try {
            const key = `activation_${deviceId}`;
            const stored = localStorage.getItem(key);

            if (!stored) return null;

            return JSON.parse(stored);
        } catch (error) {
            console.warn('读取本地激活状态失败:', error);
            return null;
        }
    }

    /**
     * 检查本地状态是否有效
     * @param {Object} status 本地状态
     * @returns {boolean} 是否有效
     */
    isLocalStatusValid(status) {
        if (!status) return false;

        // 检查是否过期
        if (status.expiresAt) {
            const expiresAt = new Date(status.expiresAt);
            if (expiresAt <= new Date()) {
                return false;
            }
        }

        // 检查保存时间是否过于久远（超过7天认为需要重新验证）
        const savedAt = new Date(status.savedAt);
        const daysSinceSaved = (new Date() - savedAt) / (1000 * 60 * 60 * 24);
        if (daysSinceSaved > 7) {
            return false;
        }

        return true;
    }

    /**
     * 清除本地激活状态
     * @param {string} deviceId 设备ID
     */
    clearActivationStatus(deviceId) {
        try {
            const key = `activation_${deviceId}`;
            localStorage.removeItem(key);
            console.log('本地激活状态已清除');
        } catch (error) {
            console.warn('清除本地激活状态失败:', error);
        }
    }

    /**
     * 检查设备是否已激活（仅检查本地状态）
     * @param {string} deviceId 设备ID
     * @returns {boolean} 是否已激活
     */
    static isActivatedLocally(deviceId) {
        try {
            const key = `activation_${deviceId}`;
            const stored = localStorage.getItem(key);

            if (!stored) return false;

            const status = JSON.parse(stored);

            // 检查是否过期
            if (status.expiresAt) {
                const expiresAt = new Date(status.expiresAt);
                if (expiresAt <= new Date()) {
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.warn('检查本地激活状态失败:', error);
            return false;
        }
    }

    /**
     * 获取本地激活状态（静态方法）
     * @param {string} deviceId 设备ID
     * @returns {Object|null} 本地激活状态
     */
    static getLocalActivationStatus(deviceId) {
        try {
            const key = `activation_${deviceId}`;
            const stored = localStorage.getItem(key);

            if (!stored) return null;

            return JSON.parse(stored);
        } catch (error) {
            console.warn('读取本地激活状态失败:', error);
            return null;
        }
    }

    /**
     * 获取错误消息
     * @param {Error} error 错误对象
     * @returns {string} 用户友好的错误消息
     */
    getErrorMessage(error) {
        if (error.name === 'AbortError') {
            return '请求超时，请检查网络连接';
        }

        if (error.message.includes('Failed to fetch')) {
            return '网络连接失败，请检查网络设置';
        }

        if (error.message.includes('HTTP 401')) {
            return 'API密钥无效，请检查配置';
        }

        if (error.message.includes('HTTP 429')) {
            return '请求过于频繁，请稍后重试';
        }

        if (error.message.includes('HTTP 500')) {
            return '服务器内部错误，请稍后重试';
        }

        return error.message || '未知错误';
    }

    /**
     * 设置请求超时时间
     * @param {number} timeout 超时时间（毫秒）
     */
    setTimeout(timeout) {
        this.timeout = timeout;
    }

    /**
     * 获取激活状态摘要
     * @param {string} deviceId 设备ID
     * @returns {Object} 状态摘要
     */
    getActivationSummary(deviceId) {
        const localStatus = this.getLocalActivationStatus(deviceId);

        if (!localStatus) {
            return {
                isActivated: false,
                status: 'not_activated',
                message: '设备未激活'
            };
        }

        if (!this.isLocalStatusValid(localStatus)) {
            return {
                isActivated: false,
                status: 'expired',
                message: '激活已过期或需要重新验证'
            };
        }

        const remainingTime = localStatus.expiresAt ?
            new Date(localStatus.expiresAt) - new Date() : null;

        return {
            isActivated: true,
            status: 'activated',
            message: '设备已激活',
            activatedAt: localStatus.activatedAt,
            expiresAt: localStatus.expiresAt,
            isPermanent: !localStatus.expiresAt,
            remainingDays: remainingTime ? Math.ceil(remainingTime / (1000 * 60 * 60 * 24)) : null,
            signatureVerified: localStatus.signatureVerified || false
        };
    }
}

// 导出到全局作用域（用于HTML页面）
if (typeof window !== 'undefined') {
    window.ActivationClient = ActivationClient;
}

// Node.js环境导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ActivationClient;
}
