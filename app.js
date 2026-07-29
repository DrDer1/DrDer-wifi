// ============================================================
// DrDer-WiFi - نقطة الدخول الرئيسية للتطبيق
// ============================================================

/**
 * الفئة الرئيسية للتطبيق
 * تدير تهيئة جميع المكونات وربط الأحداث
 */
class App {
    /**
     * تهيئة التطبيق بالكامل
     */
    static init() {
        // الانتظار حتى اكتمال تحميل DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeApp();
            });
        } else {
            this.initializeApp();
        }
    }

    /**
     * تنفيذ خطوات تهيئة التطبيق
     */
    static async initializeApp() {
        try {
            // تهيئة واجهة المستخدم أولاً
            UI.init();
            // تهيئة نظام التوجيه
            Router.init();
            // تهيئة مدير الشبكة
            NetworkManager.init();
            // إعداد جميع مستمعي الأحداث
            this.setupEventListeners();
            // تسجيل Service Worker
            await this.registerServiceWorker();
            // معالجة الهاش الأولي في الرابط
            Router.handleHashChange();
            // إظهار رسالة ترحيب
            setTimeout(() => {
                UI.showToast('مرحباً بك في DrDer-WiFi', 'info', 2000);
            }, 1500);
        } catch (error) {
            console.error('خطأ في تهيئة التطبيق:', error);
        }
    }

    /**
     * إعداد جميع مستمعي الأحداث في التطبيق
     */
    static setupEventListeners() {
        // زر تحديث قائمة الأجهزة
        const refreshBtn = document.getElementById('refresh-devices-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.handleRefreshDevices();
            });
        }
        // إعدادات الفحص المتقدم
        const advancedScanCheckbox = document.getElementById('setting-advanced-scan');
        if (advancedScanCheckbox) {
            advancedScanCheckbox.addEventListener('change', () => {
                const value = advancedScanCheckbox.checked;
                Utils.saveToStorage('advanced_scan', value);
                UI.showToast(value ? 'تم تفعيل الفحص المتقدم' : 'تم تعطيل الفحص المتقدم', 'info', 2000);
            });
        }
        // زر تقليل عدد المحاولات
        const retriesDecBtn = document.getElementById('setting-retries-dec');
        if (retriesDecBtn) {
            retriesDecBtn.addEventListener('click', () => {
                this.adjustSetting('scan_retries', -1, 1, 5, 'setting-retries-value', 'عدد المحاولات');
            });
        }
        // زر زيادة عدد المحاولات
        const retriesIncBtn = document.getElementById('setting-retries-inc');
        if (retriesIncBtn) {
            retriesIncBtn.addEventListener('click', () => {
                this.adjustSetting('scan_retries', 1, 1, 5, 'setting-retries-value', 'عدد المحاولات');
            });
        }
        // زر تقليل المهلة
        const timeoutDecBtn = document.getElementById('setting-timeout-dec');
        if (timeoutDecBtn) {
            timeoutDecBtn.addEventListener('click', () => {
                this.adjustSetting('scan_timeout', -200, 200, 5000, 'setting-timeout-value', 'مهلة الفحص');
            });
        }
        // زر زيادة المهلة
        const timeoutIncBtn = document.getElementById('setting-timeout-inc');
        if (timeoutIncBtn) {
            timeoutIncBtn.addEventListener('click', () => {
                this.adjustSetting('scan_timeout', 200, 200, 5000, 'setting-timeout-value', 'مهلة الفحص');
            });
        }
        // زر مسح الذاكرة المؤقتة
        const clearCacheBtn = document.getElementById('clear-cache-btn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                this.handleClearCache();
            });
        }
        // مستمع تغيير حالة الاتصال بالإنترنت
        window.addEventListener('online', () => {
            this.handleOnlineStatusChange(true);
        });
        window.addEventListener('offline', () => {
            this.handleOnlineStatusChange(false);
        });
        // مستمع تغيير الهاش في الرابط
        window.addEventListener('hashchange', () => {
            Router.handleHashChange();
        });
        // مستمع حدث السحب للتحديث (على الأجهزة المحمولة)
        this.setupPullToRefresh();
        // منع السحب الزائد على نظام iOS
        this.preventOverscroll();
    }

    /**
     * معالجة النقر على زر تحديث الأجهزة
     */
    static async handleRefreshDevices() {
        // الحصول على الإعدادات الحالية
        const advancedScan = Utils.getFromStorage('advanced_scan', true);
        const scanRetries = Utils.getFromStorage('scan_retries', 2);
        const scanTimeout = Utils.getFromStorage('scan_timeout', 1000);
        // بدء الفحص
        await NetworkManager.scanNetwork({
            retries: scanRetries,
            timeout: scanTimeout,
            advanced: advancedScan
        });
        // تخزين نتائج الفحص في الذاكرة المؤقتة
        const devices = NetworkManager.getDevices();
        if (devices && devices.length > 0) {
            NetworkManager.cacheDevices(devices);
        }
    }

    /**
     * تعديل قيمة إعداد رقمي
     * @param {string} storageKey - مفتاح التخزين
     * @param {number} delta - مقدار التغيير
     * @param {number} min - القيمة الدنيا
     * @param {number} max - القيمة القصوى
     * @param {string} displayElementId - معرف عنصر العرض
     * @param {string} settingName - اسم الإعداد للعرض
     */
    static adjustSetting(storageKey, delta, min, max, displayElementId, settingName) {
        const currentValue = Utils.getFromStorage(storageKey, delta > 0 ? min : max);
        let newValue = currentValue + delta;
        // التأكد من أن القيمة ضمن النطاق المسموح
        if (newValue < min) {
            newValue = min;
        }
        if (newValue > max) {
            newValue = max;
        }
        // حفظ القيمة الجديدة
        Utils.saveToStorage(storageKey, newValue);
        // تحديث العرض
        UI.updateSettingDisplay(displayElementId, newValue);
        // عرض إشعار
        let displayValue = newValue;
        if (storageKey === 'scan_timeout') {
            displayValue = newValue + ' مللي ثانية';
        }
        UI.showToast(settingName + ': ' + displayValue, 'info', 1500);
    }

    /**
     * معالجة مسح الذاكرة المؤقتة
     */
    static handleClearCache() {
        // طلب تأكيد من المستخدم
        if (confirm('هل أنت متأكد من مسح الذاكرة المؤقتة؟ سيتم حذف جميع بيانات الأجهزة المخزنة.')) {
            NetworkManager.clearCache();
            UI.showToast('تم مسح الذاكرة المؤقتة بنجاح', 'success', 2500);
        }
    }

    /**
     * معالجة تغيير حالة الاتصال بالإنترنت
     * @param {boolean} isOnline - حالة الاتصال
     */
    static handleOnlineStatusChange(isOnline) {
        if (isOnline) {
            UI.showToast('تم استعادة الاتصال بالإنترنت', 'success', 2500);
            // إعادة فحص الشبكة
            NetworkManager.detectNetwork().then(() => {
                Router.refreshHomePage();
            });
        } else {
            UI.showToast('انقطع الاتصال بالإنترنت', 'error', 3000);
            UI.updateConnectionStatus(false);
        }
    }

    /**
     * إعداد خاصية السحب للتحديث
     */
    static setupPullToRefresh() {
        let touchStartY = 0;
        let isPulling = false;
        const appMain = document.querySelector('.app-main');
        if (!appMain) {
            return;
        }
        appMain.addEventListener('touchstart', (event) => {
            // تفعيل السحب فقط عندما يكون التمرير في الأعلى
            if (appMain.scrollTop <= 0) {
                touchStartY = event.touches[0].clientY;
                isPulling = true;
            }
        }, { passive: true });
        appMain.addEventListener('touchmove', (event) => {
            if (!isPulling) {
                return;
            }
            const touchY = event.touches[0].clientY;
            const pullDistance = touchY - touchStartY;
            // إذا تم السحب لمسافة كافية
            if (pullDistance > 80 && appMain.scrollTop <= 0) {
                isPulling = false;
                // تنفيذ التحديث بناءً على الصفحة الحالية
                const currentPage = Router.getCurrentPage();
                if (currentPage === 'devices') {
                    this.handleRefreshDevices();
                } else if (currentPage === 'home' || currentPage === 'network') {
                    NetworkManager.detectNetwork().then(() => {
                        Router.refreshHomePage();
                        Router.refreshNetworkPage();
                        UI.showToast('تم تحديث معلومات الشبكة', 'success', 2000);
                    });
                }
            }
        }, { passive: true });
        appMain.addEventListener('touchend', () => {
            isPulling = false;
        }, { passive: true });
    }

    /**
     * منع السحب الزائد على نظام iOS
     */
    static preventOverscroll() {
        document.body.addEventListener('touchmove', (event) => {
            // السماح بالتمرير داخل العناصر القابلة للتمرير
            let target = event.target;
            while (target && target !== document.body) {
                if (target.classList.contains('app-main') ||
                    target.classList.contains('devices-list') ||
                    target.classList.contains('settings-list') ||
                    target.classList.contains('info-list')) {
                    return;
                }
                target = target.parentElement;
            }
            // منع السحب الافتراضي
            event.preventDefault();
        }, { passive: false });
    }

    /**
     * تسجيل Service Worker
     * @returns {Promise} وعد اكتمال التسجيل
     */
    static async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            return;
        }
        try {
            const registration = await navigator.serviceWorker.register('sw.js', {
                scope: '/'
            });
            if (registration.installing) {
                // Service Worker قيد التثبيت
            } else if (registration.waiting) {
                // Service Worker في وضع الانتظار
            } else if (registration.active) {
                // Service Worker نشط
            }
            // الاستماع لتحديثات Service Worker
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (newWorker) {
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // يوجد تحديث جديد متاح
                            UI.showToast('يتوفر تحديث جديد للتطبيق. سيتم التفعيل عند إعادة التشغيل.', 'info', 4000);
                        }
                    });
                }
            });
        } catch (error) {
            // فشل تسجيل Service Worker (قد يكون بسبب عدم دعم HTTPS في بيئة التطوير)
            console.warn('تعذر تسجيل Service Worker:', error.message);
        }
    }
}

// بدء تشغيل التطبيق عند تحميل الصفحة
App.init();
