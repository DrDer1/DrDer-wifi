// ============================================================
// DrDer-WiFi - دوال فحص الشبكة وإدارة الاتصال
// يدعم الاتصال بالخادم المحلي في Termux
// ============================================================

/**
 * فئة إدارة الشبكة والاتصال
 */
class NetworkManager {
    /**
     * تهيئة مدير الشبكة
     */
    static init() {
        // تخزين معلومات الشبكة الحالية
        this.networkInfo = {
            ssid: null,
            gateway: null,
            localIp: null,
            subnetMask: null,
            ipRange: null,
            isConnected: false,
            deviceCount: 0
        };
        // قائمة الأجهزة المكتشفة
        this.devices = [];
        // حالة الفحص الحالية
        this.isScanning = false;
        // عنوان الخادم المحلي
        this.serverURL = 'http://localhost:3000';
        // التحقق من توفر الخادم المحلي
        this.checkServerAvailability();
        // استدعاء فحص الشبكة الأولي
        this.detectNetwork();
    }

    /**
     * التحقق من توفر الخادم المحلي
     */
    static async checkServerAvailability() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const response = await fetch(this.serverURL + '/api/health', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok) {
                this.serverAvailable = true;
                UI.showToast('تم الاتصال بالخادم المحلي - جميع الميزات متاحة', 'success', 2500);
            } else {
                this.serverAvailable = false;
            }
        } catch (error) {
            this.serverAvailable = false;
        }
    }

    /**
     * الكشف عن معلومات الشبكة الحالية
     * @returns {Promise<object>} معلومات الشبكة
     */
    static async detectNetwork() {
        try {
            // محاولة استخدام الخادم المحلي أولاً
            if (this.serverAvailable) {
                try {
                    const response = await fetch(this.serverURL + '/api/network/info');
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.data) {
                            this.networkInfo = {
                                ...this.networkInfo,
                                ...data.data,
                                isConnected: true
                            };
                            // حساب نطاق الشبكة
                            if (this.networkInfo.localIp && this.networkInfo.subnetMask) {
                                this.networkInfo.ipRange = Utils.getNetworkRange(
                                    this.networkInfo.localIp,
                                    this.networkInfo.subnetMask
                                );
                            }
                            UI.updateConnectionStatus(true, this.networkInfo.ssid);
                            UI.updateHomePage(this.networkInfo);
                            UI.updateNetworkPage(this.networkInfo);
                            return this.networkInfo;
                        }
                    }
                } catch (error) {
                    // الخادم غير متاح، استخدام الطريقة المباشرة
                }
            }

            // الطريقة المباشرة عبر WebRTC (احتياطي)
            const networkData = await this.getNetworkInfoViaWebRTC();
            if (networkData) {
                this.networkInfo = {
                    ...this.networkInfo,
                    ...networkData,
                    isConnected: true
                };
            } else {
                const fallbackData = await this.getNetworkInfoFallback();
                if (fallbackData) {
                    this.networkInfo = {
                        ...this.networkInfo,
                        ...fallbackData,
                        isConnected: true
                    };
                } else {
                    this.networkInfo.isConnected = false;
                }
            }

            // حساب نطاق الشبكة
            if (this.networkInfo.localIp && this.networkInfo.subnetMask) {
                this.networkInfo.ipRange = Utils.getNetworkRange(
                    this.networkInfo.localIp,
                    this.networkInfo.subnetMask
                );
            }

            // تحديث الواجهة
            UI.updateConnectionStatus(this.networkInfo.isConnected, this.networkInfo.ssid);
            UI.updateHomePage(this.networkInfo);
            UI.updateNetworkPage(this.networkInfo);
            return this.networkInfo;
        } catch (error) {
            this.networkInfo.isConnected = false;
            UI.updateConnectionStatus(false);
            UI.updateHomePage(this.networkInfo);
            UI.updateNetworkPage(this.networkInfo);
            return this.networkInfo;
        }
    }

    /**
     * الحصول على معلومات الشبكة باستخدام WebRTC
     * @returns {Promise<object|null>} معلومات الشبكة أو null
     */
    static async getNetworkInfoViaWebRTC() {
        return new Promise((resolve) => {
            const result = {
                localIp: null,
                subnetMask: null,
                gateway: null,
                ssid: null
            };
            const timeout = setTimeout(() => {
                resolve(null);
            }, 5000);
            try {
                const pc = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                });
                pc.createDataChannel('');
                pc.createOffer()
                    .then((offer) => pc.setLocalDescription(offer))
                    .catch(() => {
                        clearTimeout(timeout);
                        resolve(null);
                    });
                pc.onicecandidate = (ice) => {
                    if (ice && ice.candidate && ice.candidate.candidate) {
                        const candidate = ice.candidate.candidate;
                        const ipRegex = /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/;
                        const match = candidate.match(ipRegex);
                        if (match && match[1]) {
                            const ip = match[1];
                            if (!ip.startsWith('127.') && !ip.startsWith('0.') && ip !== '255.255.255.255') {
                                result.localIp = ip;
                                result.subnetMask = this.guessSubnetMask(ip);
                                result.gateway = this.guessGateway(ip);
                                clearTimeout(timeout);
                                pc.close();
                                resolve(result);
                            }
                        }
                    }
                };
                setTimeout(() => {
                    if (!result.localIp) {
                        clearTimeout(timeout);
                        pc.close();
                        resolve(null);
                    }
                }, 3000);
            } catch (error) {
                clearTimeout(timeout);
                resolve(null);
            }
        });
    }

    /**
     * طريقة احتياطية للحصول على معلومات الشبكة
     * @returns {Promise<object|null>} معلومات الشبكة أو null
     */
    static async getNetworkInfoFallback() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const gateways = ['192.168.1.1', '192.168.0.1', '10.0.0.1', '172.16.0.1'];
            for (const gateway of gateways) {
                try {
                    const response = await fetch('http://' + gateway, {
                        mode: 'no-cors',
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    const gatewayParts = gateway.split('.');
                    const localIp = gatewayParts[0] + '.' + gatewayParts[1] + '.' + gatewayParts[2] + '.100';
                    return {
                        localIp: localIp,
                        gateway: gateway,
                        subnetMask: this.guessSubnetMask(localIp),
                        ssid: null
                    };
                } catch (error) {
                    // تجاهل ومتابعة المحاولة مع البوابة التالية
                }
            }
            clearTimeout(timeoutId);
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * تخمين قناع الشبكة الفرعية بناءً على عنوان IP
     * @param {string} ip - عنوان IP
     * @returns {string} قناع الشبكة الفرعية
     */
    static guessSubnetMask(ip) {
        if (!ip || !Utils.isValidIP(ip)) {
            return '255.255.255.0';
        }
        const firstOctet = parseInt(ip.split('.')[0], 10);
        if (firstOctet >= 1 && firstOctet <= 126) {
            return '255.0.0.0';
        } else if (firstOctet >= 128 && firstOctet <= 191) {
            return '255.255.0.0';
        } else if (firstOctet >= 192 && firstOctet <= 223) {
            return '255.255.255.0';
        } else {
            return '255.255.255.0';
        }
    }

    /**
     * تخمين عنوان الراوتر بناءً على عنوان IP
     * @param {string} ip - عنوان IP
     * @returns {string} عنوان الراوتر المتوقع
     */
    static guessGateway(ip) {
        if (!ip || !Utils.isValidIP(ip)) {
            return '192.168.1.1';
        }
        const parts = ip.split('.');
        const firstOctet = parseInt(parts[0], 10);
        if (firstOctet === 10) {
            return parts[0] + '.0.0.1';
        } else if (firstOctet === 172) {
            return parts[0] + '.' + parts[1] + '.0.1';
        } else {
            return parts[0] + '.' + parts[1] + '.' + parts[2] + '.1';
        }
    }

    /**
     * فحص الشبكة لاكتشاف الأجهزة المتصلة
     * @param {object} options - خيارات الفحص
     * @returns {Promise<Array>} قائمة الأجهزة المكتشفة
     */
    static async scanNetwork(options = {}) {
        if (this.isScanning) {
            return this.devices;
        }
        this.isScanning = true;
        UI.setRefreshButtonLoading(true);

        // دمج الخيارات الافتراضية مع الخيارات الممررة
        const scanOptions = {
            retries: options.retries || 2,
            timeout: options.timeout || 1000,
            advanced: options.advanced !== undefined ? options.advanced : true,
            ...options
        };

        try {
            let discoveredDevices = [];

            // المحاولة الأولى: استخدام الخادم المحلي (فحص ARP حقيقي)
            if (this.serverAvailable) {
                try {
                    const response = await fetch(this.serverURL + '/api/network/scan?refresh=true');
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.data && data.data.length > 0) {
                            discoveredDevices = data.data;
                            // تحديث معلومات الشبكة إذا كانت متوفرة
                            if (data.networkInfo) {
                                this.networkInfo = {
                                    ...this.networkInfo,
                                    ...data.networkInfo,
                                    isConnected: true
                                };
                                if (this.networkInfo.localIp && this.networkInfo.subnetMask) {
                                    this.networkInfo.ipRange = Utils.getNetworkRange(
                                        this.networkInfo.localIp,
                                        this.networkInfo.subnetMask
                                    );
                                }
                            }
                        }
                    }
                } catch (error) {
                    // الخادم غير متاح، استخدام الطريقة المباشرة
                }
            }

            // المحاولة الثانية: الفحص المباشر عبر المتصفح (احتياطي)
            if (discoveredDevices.length === 0) {
                const gateway = this.networkInfo.gateway || this.guessGateway(this.networkInfo.localIp);
                const subnetMask = this.networkInfo.subnetMask || '255.255.255.0';
                const localIp = this.networkInfo.localIp;

                if (!gateway || !subnetMask || !localIp) {
                    throw new Error('لم يتم التعرف على معلومات الشبكة. تأكد من اتصالك بالشبكة.');
                }

                const ipList = this.generateIPList(gateway, subnetMask);
                const maxIPs = 254;
                const limitedIPs = ipList.slice(0, maxIPs);
                discoveredDevices = await this.scanIPRange(limitedIPs, scanOptions, gateway, localIp);
            }

            // تحديث قائمة الأجهزة
            this.devices = discoveredDevices;
            this.networkInfo.deviceCount = discoveredDevices.length;

            // تحديث الواجهة
            UI.updateHomePage(this.networkInfo);
            UI.updateNetworkPage(this.networkInfo);
            UI.renderDevicesList(this.devices);
            UI.showToast('تم اكتشاف ' + discoveredDevices.length + ' جهاز', 'success', 2500);

            // تخزين النتائج في الذاكرة المؤقتة
            this.cacheDevices(this.devices);

            return this.devices;
        } catch (error) {
            UI.showDevicesError(error.message || 'فشل فحص الشبكة');
            UI.showToast('فشل فحص الشبكة', 'error', 3000);
            return [];
        } finally {
            this.isScanning = false;
            UI.setRefreshButtonLoading(false);
        }
    }

    /**
     * قطع اتصال جهاز عن الشبكة (عبر الخادم المحلي)
     * @param {string} ip - عنوان IP للجهاز
     * @param {string} mac - عنوان MAC للجهاز (اختياري)
     * @returns {Promise<object>} نتيجة العملية
     */
    static async disconnectDevice(ip, mac) {
        if (!this.serverAvailable) {
            return {
                success: false,
                message: 'الخادم المحلي غير متاح. يرجى تشغيل الخادم في Termux أولاً.'
            };
        }

        try {
            const response = await fetch(this.serverURL + '/api/devices/disconnect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ip: ip, mac: mac || null })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    // إزالة الجهاز من القائمة المحلية
                    this.devices = this.devices.filter(d => d.ip !== ip);
                    this.networkInfo.deviceCount = this.devices.length;
                    UI.renderDevicesList(this.devices);
                    UI.updateHomePage(this.networkInfo);
                }
                return result;
            } else {
                return {
                    success: false,
                    message: 'فشل الاتصال بالخادم المحلي'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: 'خطأ في الاتصال بالخادم: ' + error.message
            };
        }
    }

    /**
     * حظر جهاز عبر الراوتر (عبر الخادم المحلي)
     * @param {string} ip - عنوان IP للجهاز
     * @param {string} mac - عنوان MAC للجهاز
     * @returns {Promise<object>} نتيجة العملية
     */
    static async blockDevice(ip, mac) {
        if (!this.serverAvailable) {
            return {
                success: false,
                message: 'الخادم المحلي غير متاح. يرجى تشغيل الخادم في Termux أولاً.'
            };
        }

        if (!mac) {
            return {
                success: false,
                message: 'عنوان MAC مطلوب لحظر الجهاز'
            };
        }

        try {
            const response = await fetch(this.serverURL + '/api/devices/block', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ip: ip, mac: mac })
            });

            if (response.ok) {
                const result = await response.json();
                return result;
            } else {
                return {
                    success: false,
                    message: 'فشل الاتصال بالخادم المحلي'
                };
            }
        } catch (error) {
            return {
                success: false,
                message: 'خطأ في الاتصال بالخادم: ' + error.message
            };
        }
    }

    /**
     * توليد قائمة عناوين IP لفحصها
     * @param {string} gateway - عنوان الراوتر
     * @param {string} subnetMask - قناع الشبكة الفرعية
     * @returns {Array<string>} قائمة عناوين IP
     */
    static generateIPList(gateway, subnetMask) {
        const ipList = [];
        const gatewayParts = gateway.split('.').map(Number);
        const subnetParts = subnetMask.split('.').map(Number);
        const networkParts = [];
        for (let i = 0; i < 4; i++) {
            networkParts.push(gatewayParts[i] & subnetParts[i]);
        }
        const hostBits = 32 - this.countSubnetBits(subnetMask);
        const totalHosts = Math.pow(2, hostBits);
        const startIP = this.ipToNumber(networkParts.join('.')) + 1;
        const endIP = startIP + Math.min(totalHosts - 2, 254);
        for (let i = startIP; i <= endIP; i++) {
            const ip = this.numberToIP(i);
            if (Utils.isValidIP(ip)) {
                ipList.push(ip);
            }
        }
        return ipList;
    }

    /**
     * حساب عدد البتات في قناع الشبكة
     * @param {string} subnetMask - قناع الشبكة
     * @returns {number} عدد البتات
     */
    static countSubnetBits(subnetMask) {
        const parts = subnetMask.split('.').map(Number);
        let bits = 0;
        for (let i = 0; i < 4; i++) {
            let num = parts[i];
            while (num > 0) {
                if (num & 1) {
                    bits++;
                }
                num = num >> 1;
            }
        }
        return bits;
    }

    /**
     * تحويل عنوان IP إلى رقم
     * @param {string} ip - عنوان IP
     * @returns {number} القيمة الرقمية
     */
    static ipToNumber(ip) {
        const parts = ip.split('.').map(Number);
        return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    }

    /**
     * تحويل رقم إلى عنوان IP
     * @param {number} num - القيمة الرقمية
     * @returns {string} عنوان IP
     */
    static numberToIP(num) {
        const part1 = (num >>> 24) & 255;
        const part2 = (num >>> 16) & 255;
        const part3 = (num >>> 8) & 255;
        const part4 = num & 255;
        return part1 + '.' + part2 + '.' + part3 + '.' + part4;
    }

    /**
     * فحص نطاق عناوين IP
     * @param {Array<string>} ipList - قائمة عناوين IP
     * @param {object} options - خيارات الفحص
     * @param {string} gateway - عنوان الراوتر
     * @param {string} localIp - عنوان IP المحلي
     * @returns {Promise<Array>} قائمة الأجهزة المكتشفة
     */
    static async scanIPRange(ipList, options, gateway, localIp) {
        const discoveredDevices = [];
        const batchSize = 20;
        const totalBatches = Math.ceil(ipList.length / batchSize);
        for (let batch = 0; batch < totalBatches; batch++) {
            const start = batch * batchSize;
            const end = Math.min(start + batchSize, ipList.length);
            const batchIPs = ipList.slice(start, end);
            const batchPromises = batchIPs.map((ip) => {
                return this.checkIP(ip, options, gateway, localIp);
            });
            const batchResults = await Promise.all(batchPromises);
            batchResults.forEach((device) => {
                if (device) {
                    discoveredDevices.push(device);
                }
            });
            if (batch < totalBatches - 1) {
                await Utils.delay(50);
            }
        }
        return discoveredDevices;
    }

    /**
     * فحص عنوان IP محدد
     * @param {string} ip - عنوان IP
     * @param {object} options - خيارات الفحص
     * @param {string} gateway - عنوان الراوتر
     * @param {string} localIp - عنوان IP المحلي
     * @returns {Promise<object|null>} بيانات الجهاز أو null
     */
    static async checkIP(ip, options, gateway, localIp) {
        if (ip === gateway || ip === localIp) {
            return null;
        }
        for (let attempt = 0; attempt < options.retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), options.timeout);
                const response = await fetch('http://' + ip + '/', {
                    mode: 'no-cors',
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                const device = {
                    ip: ip,
                    name: null,
                    mac: null,
                    vendor: null,
                    type: null
                };
                if (options.advanced) {
                    const macInfo = await this.tryGetMAC(ip, options.timeout);
                    if (macInfo) {
                        device.mac = macInfo.mac || null;
                        if (device.mac) {
                            device.vendor = Utils.getVendorFromMAC(device.mac);
                        }
                    }
                    device.type = Utils.guessDeviceType(device.name, device.vendor);
                }
                return device;
            } catch (error) {
                if (attempt < options.retries - 1) {
                    await Utils.delay(100);
                }
            }
        }
        try {
            const imgResult = await this.checkIPViaImage(ip, options.timeout);
            if (imgResult) {
                return imgResult;
            }
        } catch (error) {
            // تجاهل الخطأ
        }
        return null;
    }

    /**
     * فحص IP باستخدام تحميل صورة
     * @param {string} ip - عنوان IP
     * @param {number} timeout - المهلة الزمنية
     * @returns {Promise<object|null>} بيانات الجهاز أو null
     */
    static checkIPViaImage(ip, timeout) {
        return new Promise((resolve) => {
            const img = new Image();
            const timer = setTimeout(() => {
                img.src = '';
                resolve(null);
            }, timeout);
            img.onload = () => {
                clearTimeout(timer);
                resolve({
                    ip: ip,
                    name: null,
                    mac: null,
                    vendor: null,
                    type: null
                });
            };
            img.onerror = () => {
                clearTimeout(timer);
                resolve({
                    ip: ip,
                    name: null,
                    mac: null,
                    vendor: null,
                    type: null
                });
            };
            img.src = 'http://' + ip + '/favicon.ico';
        });
    }

    /**
     * محاولة الحصول على عنوان MAC
     * @param {string} ip - عنوان IP
     * @param {number} timeout - المهلة الزمنية
     * @returns {Promise<object|null>} معلومات MAC أو null
     */
    static async tryGetMAC(ip, timeout) {
        const cachedDevices = Utils.getFromStorage('cached_devices', {});
        if (cachedDevices[ip]) {
            return cachedDevices[ip];
        }
        return null;
    }

    /**
     * تخزين معلومات الأجهزة في الذاكرة المؤقتة
     * @param {Array} devices - قائمة الأجهزة
     */
    static cacheDevices(devices) {
        const cache = {};
        devices.forEach((device) => {
            if (device && device.ip) {
                cache[device.ip] = {
                    mac: device.mac || null,
                    vendor: device.vendor || null,
                    name: device.name || null,
                    type: device.type || null,
                    timestamp: Date.now()
                };
            }
        });
        Utils.saveToStorage('cached_devices', cache);
    }

    /**
     * الحصول على الأجهزة من الذاكرة المؤقتة
     * @returns {Array} قائمة الأجهزة المخزنة
     */
    static getCachedDevices() {
        const cache = Utils.getFromStorage('cached_devices', {});
        const devices = [];
        const now = Date.now();
        const maxAge = 30 * 60 * 1000;
        for (const ip in cache) {
            if (cache.hasOwnProperty(ip)) {
                const entry = cache[ip];
                if (now - entry.timestamp < maxAge) {
                    devices.push({
                        ip: ip,
                        name: entry.name || ip,
                        mac: entry.mac || null,
                        vendor: entry.vendor || null,
                        type: entry.type || null
                    });
                }
            }
        }
        return devices;
    }

    /**
     * مسح الذاكرة المؤقتة للأجهزة
     */
    static clearCache() {
        Utils.removeFromStorage('cached_devices');
        this.devices = [];
        this.networkInfo.deviceCount = 0;
        UI.renderDevicesList([]);
        UI.updateHomePage(this.networkInfo);
    }

    /**
     * الحصول على معلومات الشبكة الحالية
     * @returns {object} معلومات الشبكة
     */
    static getNetworkInfo() {
        return { ...this.networkInfo };
    }

    /**
     * الحصول على قائمة الأجهزة الحالية
     * @returns {Array} قائمة الأجهزة
     */
    static getDevices() {
        return [...this.devices];
    }
}

// تصدير الفئة لتكون متاحة عالمياً
window.NetworkManager = NetworkManager;
