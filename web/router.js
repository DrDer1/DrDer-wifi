// ============================================================
// DrDer-WiFi - دوال التوجيه وإدارة الصفحات
// ============================================================

/**
 * فئة إدارة التوجيه والتنقل بين الصفحات
 */
class Router {
    /**
     * تهيئة نظام التوجيه
     */
    static init() {
        // الصفحة الافتراضية
        this.currentPage = 'home';
        // إعداد مستمعي أحداث أزرار التنقل
        this.setupNavigationListeners();
        // إعداد مستمع أحداث الرجوع في المتصفح
        this.setupPopStateListener();
        // عرض الصفحة الافتراضية
        this.navigateTo('home', false);
    }

    /**
     * إعداد مستمعي أحداث أزرار التنقل السفلية
     */
    static setupNavigationListeners() {
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach((button) => {
            button.addEventListener('click', (event) => {
                const pageName = button.getAttribute('data-page');
                if (pageName) {
                    this.navigateTo(pageName, true);
                }
            });
        });
    }

    /**
     * إعداد مستمع حدث الرجوع في المتصفح
     */
    static setupPopStateListener() {
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.page) {
                this.navigateTo(event.state.page, false);
            }
        });
    }

    /**
     * التنقل إلى صفحة محددة
     * @param {string} pageName - اسم الصفحة
     * @param {boolean} addToHistory - إضافة إلى سجل المتصفح
     */
    static navigateTo(pageName, addToHistory = true) {
        // التحقق من صحة اسم الصفحة
        const validPages = ['home', 'devices', 'network', 'settings', 'about'];
        if (!validPages.includes(pageName)) {
            pageName = 'home';
        }
        // إذا كانت الصفحة هي نفسها الحالية، لا نفعل شيئاً
        if (this.currentPage === pageName && addToHistory) {
            return;
        }
        // تحديث الصفحة الحالية
        this.currentPage = pageName;
        // عرض الصفحة في الواجهة
        UI.showPage(pageName);
        // إضافة إلى سجل المتصفح إذا لزم الأمر
        if (addToHistory) {
            const state = { page: pageName };
            const title = this.getPageTitle(pageName);
            history.pushState(state, title, '#' + pageName);
            // تحديث عنوان الصفحة
            document.title = title;
        }
        // تنفيذ إجراءات خاصة بكل صفحة
        this.handlePageActions(pageName);
        // تمرير المحتوى إلى الأعلى
        const appMain = document.querySelector('.app-main');
        if (appMain) {
            appMain.scrollTop = 0;
        }
    }

    /**
     * الحصول على عنوان الصفحة
     * @param {string} pageName - اسم الصفحة
     * @returns {string} عنوان الصفحة
     */
    static getPageTitle(pageName) {
        const titles = {
            'home': 'DrDer-WiFi | الرئيسية',
            'devices': 'DrDer-WiFi | الأجهزة المتصلة',
            'network': 'DrDer-WiFi | معلومات الشبكة',
            'settings': 'DrDer-WiFi | الإعدادات',
            'about': 'DrDer-WiFi | حول التطبيق'
        };
        return titles[pageName] || 'DrDer-WiFi';
    }

    /**
     * تنفيذ إجراءات خاصة بكل صفحة عند التنقل إليها
     * @param {string} pageName - اسم الصفحة
     */
    static handlePageActions(pageName) {
        switch (pageName) {
            case 'devices':
                // عرض قائمة الأجهزة الحالية عند فتح صفحة الأجهزة
                this.refreshDevicesPage();
                break;
            case 'network':
                // تحديث معلومات الشبكة عند فتح صفحة الشبكة
                this.refreshNetworkPage();
                break;
            case 'settings':
                // تحديث عرض الإعدادات
                this.refreshSettingsPage();
                break;
            case 'home':
                // تحديث الصفحة الرئيسية
                this.refreshHomePage();
                break;
            case 'about':
                // لا توجد إجراءات خاصة
                break;
            default:
                break;
        }
    }

    /**
     * تحديث صفحة الأجهزة
     */
    static refreshDevicesPage() {
        const devices = NetworkManager.getDevices();
        if (devices && devices.length > 0) {
            UI.renderDevicesList(devices);
        } else {
            // محاولة استرجاع الأجهزة المخزنة مؤقتاً
            const cachedDevices = NetworkManager.getCachedDevices();
            if (cachedDevices && cachedDevices.length > 0) {
                UI.renderDevicesList(cachedDevices);
            } else {
                UI.renderDevicesList([]);
            }
        }
    }

    /**
     * تحديث صفحة معلومات الشبكة
     */
    static refreshNetworkPage() {
        const networkInfo = NetworkManager.getNetworkInfo();
        UI.updateNetworkPage(networkInfo);
    }

    /**
     * تحديث صفحة الإعدادات
     */
    static refreshSettingsPage() {
        // استرجاع الإعدادات المحفوظة
        const advancedScan = Utils.getFromStorage('advanced_scan', true);
        const scanRetries = Utils.getFromStorage('scan_retries', 2);
        const scanTimeout = Utils.getFromStorage('scan_timeout', 1000);
        // تحديث عناصر الواجهة
        UI.setSettingCheckbox('setting-advanced-scan', advancedScan);
        UI.updateSettingDisplay('setting-retries-value', scanRetries);
        UI.updateSettingDisplay('setting-timeout-value', scanTimeout);
    }

    /**
     * تحديث الصفحة الرئيسية
     */
    static refreshHomePage() {
        const networkInfo = NetworkManager.getNetworkInfo();
        UI.updateHomePage(networkInfo);
        UI.updateConnectionStatus(networkInfo.isConnected, networkInfo.ssid);
    }

    /**
     * معالجة تغيير الهاش في الرابط
     */
    static handleHashChange() {
        const hash = window.location.hash.replace('#', '');
        if (hash) {
            this.navigateTo(hash, false);
        }
    }

    /**
     * الحصول على اسم الصفحة الحالية
     * @returns {string} اسم الصفحة الحالية
     */
    static getCurrentPage() {
        return this.currentPage;
    }
}

// تصدير الفئة لتكون متاحة عالمياً
window.Router = Router;
