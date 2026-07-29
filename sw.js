// اسم الكاش المستخدم لتخزين ملفات التطبيق
const CACHE_NAME = 'drder-wifi-cache-v1';

// قائمة الملفات التي سيتم تخزينها عند تثبيت Service Worker
const CACHE_ASSETS = [
    'index.html',
    'manifest.json',
    'style.css',
    'app.js',
    'network.js',
    'router.js',
    'ui.js',
    'utils.js',
    'icons/icon-192.png',
    'icons/icon-512.png'
];

// حدث تثبيت Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(CACHE_ASSETS);
            })
            .then(() => {
                // تخطي مرحلة الانتظار وتفعيل الـ Service Worker فوراً
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('فشل في تثبيت Service Worker:', error);
            })
    );
});

// حدث تفعيل Service Worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        // حذف الكاش القديم إذا كان مختلفاً عن الكاش الحالي
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                // السيطرة على جميع العملاء فوراً
                return self.clients.claim();
            })
            .catch((error) => {
                console.error('فشل في تفعيل Service Worker:', error);
            })
    );
});

// حدث جلب الطلبات (Fetch)
self.addEventListener('fetch', (event) => {
    // تجاهل الطلبات غير GET
    if (event.request.method !== 'GET') {
        return;
    }

    // تجاهل طلبات API الخارجية إن وجدت
    if (event.request.url.includes('/api/') || event.request.url.includes('chrome-extension://')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // إرجاع النسخة المخزنة مع محاولة تحديثها في الخلفية
                    const fetchPromise = fetch(event.request)
                        .then((networkResponse) => {
                            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                                const responseClone = networkResponse.clone();
                                caches.open(CACHE_NAME)
                                    .then((cache) => {
                                        cache.put(event.request, responseClone);
                                    });
                            }
                            return networkResponse;
                        })
                        .catch(() => {
                            // في حالة فشل الاتصال، إرجاع النسخة المخزنة
                            return cachedResponse;
                        });
                    return cachedResponse;
                }

                // إذا لم تكن موجودة في الكاش، جلبها من الشبكة
                return fetch(event.request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseClone);
                                });
                        }
                        return networkResponse;
                    })
                    .catch((error) => {
                        // في حالة فشل الاتصال للملفات غير الموجودة في الكاش
                        // محاولة إرجاع صفحة الخطأ الاحتياطية إذا كان الطلب لصفحة HTML
                        if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('index.html');
                        }
                        throw error;
                    });
            })
            .catch((error) => {
                console.error('فشل في جلب المورد:', event.request.url, error);
                // إرجاع استجابة خطأ مخصصة
                return new Response('حدث خطأ في الاتصال بالشبكة', {
                    status: 503,
                    statusText: 'Service Unavailable'
                });
            })
    );
});
