// ============================================================
// DrDer-WiFi - دوال واجهة المستخدم
// ============================================================

/**
 * فئة إدارة واجهة المستخدم
 */
class UI {
    /**
     * تهيئة واجهة المستخدم
     */
    static init() {
        // إخفاء شاشة التحميل بعد تحميل الصفحة
        this.hideSplashScreen();
        // تجهيز حاوية الإشعارات
        this.createToastContainer();
        // إظهار حاوية التطبيق
        this.showAppContainer();
    }

    /**
     * إخفاء شاشة التحميل الأولية
     */
    static hideSplashScreen() {
        const splashScreen = document.getElementById('splash-screen');
        if (splashScreen) {
            // تأخير بسيط لإظهار تأثير التحميل
            setTimeout(() => {
                splashScreen.classList.add('hidden');
            }, 800);
        }
    }

    /**
     * إظهار حاوية التطبيق الرئيسية
     */
    static showAppContainer() {
        const appContainer = document.getElementById('app-container');
        if (appContainer) {
            setTimeout(() => {
                appContainer.classList.add('visible');
            }, 400);
        }
    }

    /**
     * إنشاء حاوية الإشعارات (Toast)
     */
    static createToastContainer() {
        if (document.querySelector('.toast-container')) {
            return;
        }
        const container = document.createElement('div');
        container.className = 'toast-container';
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    /**
     * عرض إشعار مؤقت
     * @param {string} message - نص الإشعار
     * @param {string} type - نوع الإشعار (success, error, info)
     * @param {number} duration - مدة العرض بالمللي ثانية
     */
    static showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toast-container');
        if (!container) {
            return;
        }
        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.textContent = message;
        container.appendChild(toast);
        // إزالة الإشعار بعد انتهاء المدة
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, duration + 400);
    }

    /**
     * تحديث حالة الاتصال في الواجهة
     * @param {boolean} isConnected - حالة الاتصال
     * @param {string} ssid - اسم الشبكة (اختياري)
     */
    static updateConnectionStatus(isConnected, ssid = '') {
        const statusIndicator = document.getElementById('connection-status');
        const statusText = document.getElementById('connection-text');
        if (!statusIndicator || !statusText) {
            return;
        }
        if (isConnected) {
            statusIndicator.className = 'status-indicator online';
            statusText.textContent = ssid || 'متصل';
        } else {
            statusIndicator.className = 'status-indicator offline';
            statusText.textContent = 'غير متصل';
        }
    }

    /**
     * تحديث معلومات الصفحة الرئيسية
     * @param {object} networkInfo - معلومات الشبكة
     */
    static updateHomePage(networkInfo) {
        const ssidEl = document.getElementById('home-ssid');
        const gatewayEl = document.getElementById('home-gateway');
        const deviceCountEl = document.getElementById('home-device-count');
        const localIpEl = document.getElementById('home-local-ip');
        if (ssidEl) {
            ssidEl.textContent = networkInfo.ssid || 'غير معروف';
        }
        if (gatewayEl) {
            gatewayEl.textContent = networkInfo.gateway || '---';
        }
        if (deviceCountEl) {
            deviceCountEl.textContent = networkInfo.deviceCount || 0;
        }
        if (localIpEl) {
            localIpEl.textContent = networkInfo.localIp || '---';
        }
    }

    /**
     * تحديث صفحة معلومات الشبكة
     * @param {object} networkInfo - معلومات الشبكة
     */
    static updateNetworkPage(networkInfo) {
        const ssidEl = document.getElementById('net-ssid');
        const gatewayEl = document.getElementById('net-gateway');
        const localIpEl = document.getElementById('net-local-ip');
        const subnetEl = document.getElementById('net-subnet');
        const rangeEl = document.getElementById('net-range');
        const statusEl = document.getElementById('net-status');
        if (ssidEl) {
            ssidEl.textContent = networkInfo.ssid || '---';
        }
        if (gatewayEl) {
            gatewayEl.textContent = networkInfo.gateway || '---';
        }
        if (localIpEl) {
            localIpEl.textContent = networkInfo.localIp || '---';
        }
        if (subnetEl) {
            subnetEl.textContent = networkInfo.subnetMask || '---';
        }
        if (rangeEl) {
            rangeEl.textContent = networkInfo.ipRange || '---';
        }
        if (statusEl) {
            statusEl.textContent = networkInfo.isConnected ? 'متصل' : 'غير متصل';
            statusEl.style.color = networkInfo.isConnected ? '#4caf50' : '#f44336';
        }
    }

    /**
     * عرض قائمة الأجهزة في صفحة الأجهزة المتصلة
     * @param {Array} devices - مصفوفة الأجهزة
     */
    static renderDevicesList(devices) {
        const devicesList = document.getElementById('devices-list');
        if (!devicesList) {
            return;
        }
        // مسح المحتوى السابق
        devicesList.innerHTML = '';
        if (!devices || devices.length === 0) {
            // عرض رسالة عدم وجود أجهزة
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="20" cy="20" r="8" stroke="#333" stroke-width="2" fill="none"/>
                    <circle cx="40" cy="28" r="8" stroke="#333" stroke-width="2" fill="none"/>
                    <circle cx="25" cy="42" r="8" stroke="#333" stroke-width="2" fill="none"/>
                    <line x1="25" y1="23" x2="35" y2="26" stroke="#333" stroke-width="1.5"/>
                    <line x1="25" y1="25" x2="26" y2="36" stroke="#333" stroke-width="1.5"/>
                </svg>
                <p>لا توجد أجهزة مكتشفة</p>
                <span>اضغط على زر التحديث لفحص الشبكة</span>
            `;
            devicesList.appendChild(emptyState);
            return;
        }
        // فرز الأجهزة حسب عنوان IP
        const sortedDevices = [...devices].sort((a, b) => {
            return Utils.ipToNumber(a.ip) - Utils.ipToNumber(b.ip);
        });
        // إنشاء بطاقة لكل جهاز
        sortedDevices.forEach((device, index) => {
            const card = this.createDeviceCard(device, index);
            devicesList.appendChild(card);
        });
    }

    /**
     * إنشاء بطاقة جهاز واحد
     * @param {object} device - بيانات الجهاز
     * @param {number} index - فهرس الجهاز
     * @returns {HTMLElement} عنصر بطاقة الجهاز
     */
    static createDeviceCard(device, index) {
        const card = document.createElement('div');
        card.className = 'device-card';
        card.style.animationDelay = (index * 0.05) + 's';
        // اختيار أيقونة مناسبة بناءً على نوع الجهاز
        let deviceIcon = this.getDeviceIcon(device.type, device.vendor);
        // تجميع التفاصيل الإضافية
        let detailsHTML = '';
        if (device.mac) {
            detailsHTML += '<span class="device-detail-tag mac">' + device.mac + '</span>';
        }
        if (device.vendor) {
            detailsHTML += '<span class="device-detail-tag vendor">' + device.vendor + '</span>';
        }
        if (device.type) {
            detailsHTML += '<span class="device-detail-tag type">' + device.type + '</span>';
        }
        card.innerHTML = `
            <div class="device-icon">
                ${deviceIcon}
            </div>
            <div class="device-info">
                <div class="device-name">${this.escapeHTML(device.name || device.ip)}</div>
                <div class="device-details">
                    <span class="device-detail-tag">${device.ip}</span>
                    ${detailsHTML}
                </div>
            </div>
        `;
        // إضافة حدث النقر لنسخ عنوان IP
        card.addEventListener('click', () => {
            this.copyDeviceIP(device.ip);
        });
        return card;
    }

    /**
     * الحصول على أيقونة SVG للجهاز بناءً على نوعه
     * @param {string} type - نوع الجهاز
     * @param {string} vendor - الشركة المصنعة
     * @returns {string} أيقونة SVG
     */
    static getDeviceIcon(type, vendor) {
        const typeLower = (type || '').toLowerCase();
        const vendorLower = (vendor || '').toLowerCase();
        // أيقونة الهاتف الذكي
        if (typeLower.includes('هاتف') || typeLower.includes('موبايل') || typeLower.includes('smartphone')) {
            return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="2" width="14" height="20" rx="2.5" stroke="#00bcd4" stroke-width="2" fill="none"/>
                <line x1="9" y1="18" x2="15" y2="18" stroke="#00bcd4" stroke-width="1.5" stroke-linecap="round"/>
                <circle cx="12" cy="7" r="1" fill="#00bcd4"/>
            </svg>`;
        }
        // أيقونة الحاسوب
        if (typeLower.includes('حاسوب') || typeLower.includes('كمبيوتر') || typeLower.includes('لابتوب') || typeLower.includes('desktop') || typeLower.includes('laptop')) {
            return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="4" width="18" height="12" rx="2" stroke="#00bcd4" stroke-width="2" fill="none"/>
                <line x1="2" y1="18" x2="22" y2="18" stroke="#00bcd4" stroke-width="2" stroke-linecap="round"/>
                <line x1="12" y1="16" x2="12" y2="18" stroke="#00bcd4" stroke-width="1.5"/>
            </svg>`;
        }
        // أيقونة الجهاز اللوحي
        if (typeLower.includes('لوحي') || typeLower.includes('تابلت') || typeLower.includes('tablet') || typeLower.includes('ipad')) {
            return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="18" height="18" rx="3" stroke="#00bcd4" stroke-width="2" fill="none"/>
                <circle cx="12" cy="16" r="1" fill="#00bcd4"/>
            </svg>`;
        }
        // أيقونة التلفاز
        if (typeLower.includes('تلفاز') || typeLower.includes('tv') || typeLower.includes('television')) {
            return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="2" y="4" width="20" height="14" rx="2" stroke="#00bcd4" stroke-width="2" fill="none"/>
                <line x1="8" y1="21" x2="16" y2="21" stroke="#00bcd4" stroke-width="2" stroke-linecap="round"/>
            </svg>`;
        }
        // أيقونة الطابعة
        if (typeLower.includes('طابعة') || typeLower.includes('printer')) {
            return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="5" y="8" width="14" height="10" rx="2" stroke="#00bcd4" stroke-width="2" fill="none"/>
                <rect x="7" y="3" width="10" height="5" rx="1" stroke="#00bcd4" stroke-width="2" fill="none"/>
                <circle cx="8" cy="13" r="1.5" fill="#00bcd4"/>
            </svg>`;
        }
        // أيقونة جهاز الشبكة
        if (typeLower.includes('شبكة') || typeLower.includes('راوتر') || typeLower.includes('router') || typeLower.includes('gateway')) {
            return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="6" stroke="#00bcd4" stroke-width="2" fill="none"/>
                <circle cx="12" cy="12" r="2" fill="#00bcd4"/>
                <line x1="12" y1="6" x2="12" y2="10" stroke="#00bcd4" stroke-width="1.5"/>
                <line x1="12" y1="14" x2="12" y2="18" stroke="#00bcd4" stroke-width="1.5"/>
                <line x1="6" y1="12" x2="10" y2="12" stroke="#00bcd4" stroke-width="1.5"/>
                <line x1="14" y1="12" x2="18" y2="12" stroke="#00bcd4" stroke-width="1.5"/>
            </svg>`;
        }
        // أيقونة الساعة الذكية
        if (typeLower.includes('ساعة') || typeLower.includes('watch')) {
            return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="3" width="12" height="18" rx="5" stroke="#00bcd4" stroke-width="2" fill="none"/>
                <line x1="9" y1="1" x2="15" y2="1" stroke="#00bcd4" stroke-width="2" stroke-linecap="round"/>
                <line x1="9" y1="23" x2="15" y2="23" stroke="#00bcd4" stroke-width="2" stroke-linecap="round"/>
                <circle cx="12" cy="12" r="2" fill="#00bcd4"/>
                <line x1="12" y1="12" x2="12" y2="8" stroke="#00bcd4" stroke-width="1.5" stroke-linecap="round"/>
            </svg>`;
        }
        // أيقونة السماعة الذكية
        if (typeLower.includes('مكبر') || typeLower.includes('سماعة') || typeLower.includes('speaker') || typeLower.includes('alexa') || typeLower.includes('echo')) {
            return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="4" y="8" width="16" height="10" rx="5" stroke="#00bcd4" stroke-width="2" fill="none"/>
                <line x1="12" y1="3" x2="12" y2="8" stroke="#00bcd4" stroke-width="2" stroke-linecap="round"/>
                <circle cx="12" cy="13" r="3" fill="#00bcd4"/>
            </svg>`;
        }
        // أيقونة افتراضية للجهاز غير المعروف
        return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="3" width="16" height="14" rx="2" stroke="#00bcd4" stroke-width="2" fill="none"/>
            <line x1="8" y1="20" x2="16" y2="20" stroke="#00bcd4" stroke-width="2" stroke-linecap="round"/>
            <line x1="12" y1="17" x2="12" y2="20" stroke="#00bcd4" stroke-width="1.5"/>
            <circle cx="12" cy="9" r="1.5" fill="#00bcd4"/>
        </svg>`;
    }

    /**
     * نسخ عنوان IP إلى الحافظة مع إظهار إشعار
     * @param {string} ip - عنوان IP
     */
    static async copyDeviceIP(ip) {
        const success = await Utils.copyToClipboard(ip);
        if (success) {
            this.showToast('تم نسخ العنوان: ' + ip, 'success', 2000);
        } else {
            this.showToast('فشل نسخ العنوان', 'error', 2000);
        }
    }

    /**
     * تعيين حالة التحميل لزر التحديث
     * @param {boolean} isLoading - حالة التحميل
     */
    static setRefreshButtonLoading(isLoading) {
        const refreshBtn = document.getElementById('refresh-devices-btn');
        if (!refreshBtn) {
            return;
        }
        if (isLoading) {
            refreshBtn.classList.add('spinning');
            refreshBtn.disabled = true;
        } else {
            refreshBtn.classList.remove('spinning');
            refreshBtn.disabled = false;
        }
    }

    /**
     * تفعيل زر التنقل النشط
     * @param {string} pageName - اسم الصفحة
     */
    static setActiveNavButton(pageName) {
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach((btn) => {
            const btnPage = btn.getAttribute('data-page');
            if (btnPage === pageName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    /**
     * إظهار صفحة محددة وإخفاء الباقي
     * @param {string} pageName - اسم الصفحة
     */
    static showPage(pageName) {
        const pages = document.querySelectorAll('.page');
        pages.forEach((page) => {
            page.classList.remove('active');
        });
        const targetPage = document.getElementById('page-' + pageName);
        if (targetPage) {
            targetPage.classList.add('active');
            // تمرير الصفحة إلى الأعلى
            document.querySelector('.app-main').scrollTop = 0;
        }
        this.setActiveNavButton(pageName);
    }

    /**
     * تحديث عرض قيمة الإعدادات
     * @param {string} elementId - معرف العنصر
     * @param {*} value - القيمة
     */
    static updateSettingDisplay(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        }
    }

    /**
     * الحصول على حالة إعداد محدد (checkbox)
     * @param {string} elementId - معرف العنصر
     * @returns {boolean} حالة الإعداد
     */
    static getSettingCheckbox(elementId) {
        const element = document.getElementById(elementId);
        if (element && element.type === 'checkbox') {
            return element.checked;
        }
        return false;
    }

    /**
     * تعيين حالة إعداد محدد (checkbox)
     * @param {string} elementId - معرف العنصر
     * @param {boolean} value - القيمة
     */
    static setSettingCheckbox(elementId, value) {
        const element = document.getElementById(elementId);
        if (element && element.type === 'checkbox') {
            element.checked = value;
        }
    }

    /**
     * تهريب النص لمنع هجمات XSS
     * @param {string} text - النص المراد تهريبه
     * @returns {string} النص المهرب
     */
    static escapeHTML(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * عرض رسالة خطأ في صفحة الأجهزة
     * @param {string} message - رسالة الخطأ
     */
    static showDevicesError(message) {
        const devicesList = document.getElementById('devices-list');
        if (!devicesList) {
            return;
        }
        devicesList.innerHTML = `
            <div class="empty-state">
                <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="30" cy="30" r="20" stroke="#f44336" stroke-width="2" fill="none"/>
                    <line x1="22" y1="22" x2="38" y2="38" stroke="#f44336" stroke-width="2.5" stroke-linecap="round"/>
                    <line x1="38" y1="22" x2="22" y2="38" stroke="#f44336" stroke-width="2.5" stroke-linecap="round"/>
                </svg>
                <p>حدث خطأ</p>
                <span>${this.escapeHTML(message)}</span>
            </div>
        `;
    }
}

// تصدير الفئة لتكون متاحة عالمياً
window.UI = UI;
