// ============================================================
// DrDer-WiFi - دوال مساعدة عامة
// ============================================================

/**
 * فئة الأدوات المساعدة للتطبيق
 */
class Utils {
    /**
     * إنشاء معرف فريد للنظام
     * @returns {string} معرف فريد
     */
    static generateId() {
        return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
    }

    /**
     * تنسيق عنوان MAC ليكون موحداً
     * @param {string} mac - عنوان MAC الخام
     * @returns {string} عنوان MAC منسق
     */
    static formatMAC(mac) {
        if (!mac || typeof mac !== 'string') {
            return null;
        }
        // إزالة جميع الأحرف غير الصالحة
        let cleaned = mac.replace(/[^0-9a-fA-F]/g, '');
        if (cleaned.length !== 12) {
            return null;
        }
        // إضافة النقطتين كل حرفين
        cleaned = cleaned.toUpperCase();
        return cleaned.match(/.{1,2}/g).join(':');
    }

    /**
     * التحقق من صحة عنوان IP
     * @param {string} ip - عنوان IP
     * @returns {boolean} صحيح إذا كان العنوان صالحاً
     */
    static isValidIP(ip) {
        if (!ip || typeof ip !== 'string') {
            return false;
        }
        const parts = ip.split('.');
        if (parts.length !== 4) {
            return false;
        }
        for (let i = 0; i < parts.length; i++) {
            const num = parseInt(parts[i], 10);
            if (isNaN(num) || num < 0 || num > 255) {
                return false;
            }
            if (parts[i].length > 1 && parts[i][0] === '0') {
                return false;
            }
        }
        return true;
    }

    /**
     * الحصول على نطاق الشبكة من عنوان IP وقناع الشبكة
     * @param {string} ip - عنوان IP
     * @param {string} subnet - قناع الشبكة الفرعية
     * @returns {string} نطاق الشبكة
     */
    static getNetworkRange(ip, subnet) {
        if (!this.isValidIP(ip) || !this.isValidIP(subnet)) {
            return null;
        }
        const ipParts = ip.split('.').map(Number);
        const subnetParts = subnet.split('.').map(Number);
        const networkParts = [];
        const broadcastParts = [];
        for (let i = 0; i < 4; i++) {
            networkParts.push(ipParts[i] & subnetParts[i]);
            broadcastParts.push((ipParts[i] & subnetParts[i]) | (255 - subnetParts[i]));
        }
        return networkParts.join('.') + ' - ' + broadcastParts.join('.');
    }

    /**
     * تحويل عنوان IP إلى رقم للفرز
     * @param {string} ip - عنوان IP
     * @returns {number} القيمة الرقمية للعنوان
     */
    static ipToNumber(ip) {
        if (!this.isValidIP(ip)) {
            return 0;
        }
        const parts = ip.split('.').map(Number);
        return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    }

    /**
     * محاولة تحديد اسم الشركة المصنعة من عنوان MAC
     * @param {string} mac - عنوان MAC
     * @returns {string|null} اسم الشركة المصنعة أو null
     */
    static getVendorFromMAC(mac) {
        if (!mac || typeof mac !== 'string') {
            return null;
        }
        const cleaned = mac.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
        if (cleaned.length < 6) {
            return null;
        }
        const oui = cleaned.substring(0, 6);
        // قاعدة بيانات محدودة لأشهر الشركات المصنعة (OUI)
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
            'DC4F22': 'أوبو',
            'D4E6B7': 'فيفو',
            '78D9E9': 'ريلمي',
            '9801A7': 'ون بلس',
            'C4B301': 'نوكيا',
            '0026BB': 'راسبيري باي',
            'B827EB': 'راسبيري باي'
        };
        return vendorDB[oui] || null;
    }

    /**
     * محاولة تحديد نوع الجهاز من اسم المضيف أو معلومات أخرى
     * @param {string} hostname - اسم المضيف
     * @param {string} vendor - اسم الشركة المصنعة
     * @returns {string|null} نوع الجهاز المتوقع
     */
    static guessDeviceType(hostname, vendor) {
        const hostLower = (hostname || '').toLowerCase();
        const vendorLower = (vendor || '').toLowerCase();
        if (hostLower.includes('iphone') || hostLower.includes('ipad') || vendorLower === 'آبل') {
            if (hostLower.includes('ipad')) {
                return 'جهاز لوحي';
            }
            return 'هاتف ذكي';
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
        if (vendorLower === 'سامسونج' || vendorLower === 'شاومي' || vendorLower === 'هواوي' || vendorLower === 'أوبو' || vendorLower === 'فيفو' || vendorLower === 'ريلمي' || vendorLower === 'ون بلس') {
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

    /**
     * تأخير التنفيذ (وعد)
     * @param {number} ms - مدة التأخير بالمللي ثانية
     * @returns {Promise} وعد يتم حله بعد المدة المحددة
     */
    static delay(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

    /**
     * حفظ البيانات في LocalStorage
     * @param {string} key - المفتاح
     * @param {*} value - القيمة
     */
    static saveToStorage(key, value) {
        try {
            const serialized = JSON.stringify(value);
            localStorage.setItem('drder_wifi_' + key, serialized);
        } catch (error) {
            // تجاهل أخطاء التخزين (مثل امتلاء المساحة)
        }
    }

    /**
     * استرجاع البيانات من LocalStorage
     * @param {string} key - المفتاح
     * @param {*} defaultValue - القيمة الافتراضية
     * @returns {*} القيمة المسترجعة أو القيمة الافتراضية
     */
    static getFromStorage(key, defaultValue = null) {
        try {
            const serialized = localStorage.getItem('drder_wifi_' + key);
            if (serialized === null) {
                return defaultValue;
            }
            return JSON.parse(serialized);
        } catch (error) {
            return defaultValue;
        }
    }

    /**
     * حذف بيانات من LocalStorage
     * @param {string} key - المفتاح
     */
    static removeFromStorage(key) {
        try {
            localStorage.removeItem('drder_wifi_' + key);
        } catch (error) {
            // تجاهل الأخطاء
        }
    }

    /**
     * مسح جميع بيانات التطبيق من LocalStorage
     */
    static clearAllStorage() {
        try {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('drder_wifi_')) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach((key) => {
                localStorage.removeItem(key);
            });
        } catch (error) {
            // تجاهل الأخطاء
        }
    }

    /**
     * نسخ النص إلى الحافظة
     * @param {string} text - النص المراد نسخه
     * @returns {Promise<boolean>} نجاح أو فشل العملية
     */
    static async copyToClipboard(text) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
            // طريقة احتياطية للأجهزة القديمة
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return true;
        } catch (error) {
            return false;
        }
    }
}

// تصدير الفئة لتكون متاحة عالمياً
window.Utils = Utils;
