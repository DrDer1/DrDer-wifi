// ============================================================
// DrDer-WiFi - الخادم المحلي الرئيسي
// يعمل داخل Termux على أندرويد
// يوفر REST API لتطبيق PWA
// ============================================================

const express = require('express');
const cors = require('cors');
const { RealScanner } = require('./scanner');
const { DeviceController } = require('./controller');

const app = express();
const PORT = 3000;

// إعدادات CORS للسماح بالاتصال من تطبيق PWA
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// تخزين مؤقت للبيانات
let cachedDevices = [];
let cachedNetworkInfo = null;
let lastScanTime = 0;
const CACHE_DURATION = 30000; // 30 ثانية

// ============================================================
// نقاط النهاية API
// ============================================================

/**
 * الصفحة الرئيسية للخادم
 */
app.get('/', (req, res) => {
    res.json({
        name: 'DrDer-WiFi Server',
        version: '1.0.0',
        status: 'running',
        endpoints: [
            'GET  /api/network/info',
            'GET  /api/network/scan',
            'GET  /api/devices',
            'POST /api/devices/disconnect',
            'POST /api/devices/block',
            'GET  /api/devices/active',
            'GET  /api/bandwidth',
            'POST /api/wifi/restart'
        ]
    });
});

/**
 * الحصول على معلومات الشبكة
 */
app.get('/api/network/info', async (req, res) => {
    try {
        const forceRefresh = req.query.refresh === 'true';
        const now = Date.now();

        if (!forceRefresh && cachedNetworkInfo && (now - lastScanTime) < CACHE_DURATION) {
            return res.json({
                success: true,
                data: cachedNetworkInfo,
                cached: true
            });
        }

        const networkInfo = await RealScanner.getNetworkInfo();
        cachedNetworkInfo = networkInfo;
        lastScanTime = now;

        res.json({
            success: true,
            data: networkInfo,
            cached: false
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'فشل في الحصول على معلومات الشبكة',
            message: error.message
        });
    }
});

/**
 * فحص الشبكة والحصول على الأجهزة المتصلة مع MAC حقيقي
 */
app.get('/api/network/scan', async (req, res) => {
    try {
        const forceRefresh = req.query.refresh === 'true';
        const now = Date.now();

        if (!forceRefresh && cachedDevices.length > 0 && (now - lastScanTime) < CACHE_DURATION) {
            return res.json({
                success: true,
                data: cachedDevices,
                count: cachedDevices.length,
                cached: true
            });
        }

        const networkInfo = await RealScanner.getNetworkInfo();
        cachedNetworkInfo = networkInfo;

        const devices = await RealScanner.scanARP();
        cachedDevices = devices;
        lastScanTime = now;

        res.json({
            success: true,
            data: devices,
            count: devices.length,
            networkInfo: networkInfo,
            cached: false
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'فشل في فحص الشبكة',
            message: error.message
        });
    }
});

/**
 * الحصول على قائمة الأجهزة المخزنة مؤقتاً
 */
app.get('/api/devices', (req, res) => {
    if (cachedDevices.length === 0) {
        return res.json({
            success: true,
            data: [],
            count: 0,
            message: 'لم يتم الفحص بعد. استخدم /api/network/scan أولاً.'
        });
    }

    res.json({
        success: true,
        data: cachedDevices,
        count: cachedDevices.length,
        lastScan: lastScanTime
    });
});

/**
 * الحصول على الأجهزة النشطة حالياً
 */
app.get('/api/devices/active', async (req, res) => {
    try {
        const activeDevices = await DeviceController.getActiveDevices();
        res.json({
            success: true,
            data: activeDevices,
            count: activeDevices.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'فشل في الحصول على الأجهزة النشطة',
            message: error.message
        });
    }
});

/**
 * قطع اتصال جهاز محدد
 */
app.post('/api/devices/disconnect', async (req, res) => {
    try {
        const { ip, mac } = req.body;

        if (!ip) {
            return res.status(400).json({
                success: false,
                error: 'يرجى تحديد عنوان IP للجهاز'
            });
        }

        const result = await DeviceController.disconnectDevice(ip, mac || null);

        // تحديث الذاكرة المؤقتة بعد القطع
        if (result.success) {
            cachedDevices = cachedDevices.filter(d => d.ip !== ip);
            lastScanTime = 0; // إجبار إعادة الفحص في المرة القادمة
        }

        res.json({
            success: result.success,
            method: result.method,
            message: result.message
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'فشل في قطع اتصال الجهاز',
            message: error.message
        });
    }
});

/**
 * حظر جهاز عبر الراوتر
 */
app.post('/api/devices/block', async (req, res) => {
    try {
        const { ip, mac } = req.body;

        if (!mac) {
            return res.status(400).json({
                success: false,
                error: 'عنوان MAC مطلوب لحظر الجهاز عبر الراوتر'
            });
        }

        const networkInfo = await RealScanner.getNetworkInfo();
        const gateway = networkInfo.gateway;

        if (!gateway) {
            return res.status(400).json({
                success: false,
                error: 'لم يتم العثور على عنوان الراوتر'
            });
        }

        const result = await DeviceController.blockViaRouter(mac, gateway);

        res.json({
            success: result.success,
            method: result.method,
            message: result.message
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'فشل في حظر الجهاز',
            message: error.message
        });
    }
});

/**
 * الحصول على استهلاك الباندويث
 */
app.get('/api/bandwidth', async (req, res) => {
    try {
        const usage = await DeviceController.getBandwidthUsage();
        res.json({
            success: true,
            data: usage
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'فشل في مراقبة الباندويث',
            message: error.message
        });
    }
});

/**
 * إعادة تشغيل Wi-Fi
 */
app.post('/api/wifi/restart', async (req, res) => {
    try {
        const result = await DeviceController.restartAccessPoint();

        if (result.success) {
            cachedDevices = [];
            cachedNetworkInfo = null;
            lastScanTime = 0;
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'فشل في إعادة تشغيل Wi-Fi',
            message: error.message
        });
    }
});

/**
 * نقطة نهاية للحالة الصحية للخادم
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cachedDevices: cachedDevices.length,
        lastScan: lastScanTime
    });
});

// ============================================================
// معالجة الأخطاء العامة
// ============================================================
app.use((err, req, res, next) => {
    console.error('خطأ في الخادم:', err);
    res.status(500).json({
        success: false,
        error: 'خطأ داخلي في الخادم',
        message: err.message
    });
});

// معالجة المسارات غير الموجودة
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'المسار غير موجود',
        path: req.originalUrl
    });
});

// ============================================================
// بدء تشغيل الخادم
// ============================================================
app.listen(PORT, '127.0.0.1', () => {
    console.log('╔══════════════════════════════════════╗');
    console.log('║     DrDer-WiFi Server v1.0.0        ║');
    console.log('║     يعمل على المنفذ: ' + PORT + '             ║');
    console.log('║     http://localhost:' + PORT + '             ║');
    console.log('╚══════════════════════════════════════╝');
    console.log('');
    console.log('نقاط النهاية المتاحة:');
    console.log('  GET  /api/network/info');
    console.log('  GET  /api/network/scan');
    console.log('  GET  /api/devices');
    console.log('  POST /api/devices/disconnect');
    console.log('  POST /api/devices/block');
    console.log('  GET  /api/devices/active');
    console.log('  GET  /api/bandwidth');
    console.log('  POST /api/wifi/restart');
    console.log('');
});

// معالجة إيقاف الخادم بشكل آمن
process.on('SIGINT', () => {
    console.log('\nتم إيقاف الخادم.');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nتم إنهاء الخادم.');
    process.exit(0);
});
