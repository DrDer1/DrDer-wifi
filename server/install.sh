#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
# DrDer-WiFi - سكريبت التثبيت التلقائي في Termux
# ============================================================

echo "╔══════════════════════════════════════════╗"
echo "║     DrDer-WiFi - أداة تثبيت الخادم       ║"
echo "║           Termux على أندرويد             ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# دالة عرض الخطأ والخروج
error_exit() {
    echo ""
    echo "❌ خطأ: $1"
    echo ""
    exit 1
}

# دالة عرض النجاح
success_msg() {
    echo "✅ $1"
}

# دالة عرض المعلومات
info_msg() {
    echo "📋 $1"
}

# التحقق من أننا نعمل داخل Termux
if [ -z "$TERMUX_VERSION" ]; then
    error_exit "هذا السكريبت يجب تشغيله داخل Termux على أندرويد فقط."
fi

info_msg "تم التأكد من بيئة Termux"

# تحديث الحزم الأساسية
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 تحديث مستودعات الحزم..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pkg update -y || error_exit "فشل تحديث المستودعات"
success_msg "تم تحديث المستودعات"

# ترقية الحزم المثبتة
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⬆️  ترقية الحزم المثبتة..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pkg upgrade -y || error_exit "فشل ترقية الحزم"
success_msg "تم ترقية الحزم"

# تثبيت Node.js
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 تثبيت Node.js..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if command -v node &> /dev/null; then
    info_msg "Node.js مثبت مسبقاً: $(node --version)"
else
    pkg install nodejs -y || error_exit "فشل تثبيت Node.js"
    success_msg "تم تثبيت Node.js: $(node --version)"
fi

# تثبيت أدوات الشبكة الأساسية
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 تثبيت أدوات الشبكة..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# تثبيت net-tools (يحتوي على arp, netstat, ifconfig)
if command -v arp &> /dev/null; then
    info_msg "net-tools مثبت مسبقاً"
else
    pkg install net-tools -y || info_msg "تعذر تثبيت net-tools (قد لا يكون متوفراً)"
    command -v arp &> /dev/null && success_msg "تم تثبيت net-tools"
fi

# تثبيت iproute2 (يحتوي على ip neigh)
if command -v ip &> /dev/null; then
    info_msg "iproute2 مثبت مسبقاً"
else
    pkg install iproute2 -y || info_msg "تعذر تثبيت iproute2"
    command -v ip &> /dev/null && success_msg "تم تثبيت iproute2"
fi

# تثبيت nmap (فحص متقدم للشبكة)
if command -v nmap &> /dev/null; then
    info_msg "nmap مثبت مسبقاً"
else
    pkg install nmap -y || info_msg "تعذر تثبيت nmap (اختياري)"
    command -v nmap &> /dev/null && success_msg "تم تثبيت nmap"
fi

# تثبيت tcpdump (مراقبة الحركة)
if command -v tcpdump &> /dev/null; then
    info_msg "tcpdump مثبت مسبقاً"
else
    pkg install tcpdump -y || info_msg "تعذر تثبيت tcpdump (اختياري)"
    command -v tcpdump &> /dev/null && success_msg "تم تثبيت tcpdump"
fi

# تثبيت dsniff (يحتوي على arpspoof)
if command -v arpspoof &> /dev/null; then
    info_msg "dsniff مثبت مسبقاً"
else
    pkg install dsniff -y || info_msg "تعذر تثبيت dsniff (اختياري - للتحكم المتقدم)"
    command -v arpspoof &> /dev/null && success_msg "تم تثبيت dsniff"
fi

# تثبيت aircrack-ng (للهجمات المتقدمة)
if command -v aireplay-ng &> /dev/null; then
    info_msg "aircrack-ng مثبت مسبقاً"
else
    pkg install aircrack-ng -y || info_msg "تعذر تثبيت aircrack-ng (اختياري)"
    command -v aireplay-ng &> /dev/null && success_msg "تم تثبيت aircrack-ng"
fi

# تثبيت مكتبات Node.js
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 تثبيت مكتبات Node.js..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd "$(dirname "$0")" || error_exit "تعذر الوصول إلى مجلد المشروع"

if [ -f "package.json" ]; then
    npm install || error_exit "فشل تثبيت مكتبات Node.js"
    success_msg "تم تثبيت مكتبات Node.js"
else
    error_exit "ملف package.json غير موجود. تأكد من أنك في مجلد server الصحيح."
fi

# إنشاء مجلد للأيقونات إذا لم يكن موجوداً
if [ ! -d "../icons" ]; then
    mkdir -p ../icons 2>/dev/null
fi

# عرض ملخص التثبيت
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     ✅ اكتمل التثبيت بنجاح               ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 ملخص الأدوات المثبتة:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# التحقق من الأدوات وعرض حالتها
check_tool() {
    if command -v "$1" &> /dev/null; then
        echo "   ✅ $1 - متوفر"
    else
        echo "   ⚠️  $1 - غير متوفر (اختياري)"
    fi
}

echo "🔧 أدوات النظام:"
check_tool "node"
check_tool "npm"
check_tool "arp"
check_tool "ip"
echo ""
echo "🔍 أدوات الفحص:"
check_tool "nmap"
check_tool "tcpdump"
echo ""
echo "🛡️  أدوات التحكم:"
check_tool "arpspoof"
check_tool "aireplay-ng"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 لتشغيل الخادم:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   cd $(pwd)"
echo "   node server.js"
echo ""
echo "   أو باستخدام npm:"
echo "   npm start"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 لتشغيل تطبيق PWA:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   1. افتح المتصفح على هاتفك"
echo "   2. اذهب إلى: http://localhost:3000"
echo "   3. أو افتح ملف index.html مباشرة"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚠️  ملاحظات مهمة:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   • بعض الأدوات قد تحتاج صلاحيات root"
echo "   • قطع اتصال الأجهزة الأخرى قد يكون"
echo "     غير قانوني في بعض الدول"
echo "   • استخدم هذه الأدوات على شبكتك الخاصة فقط"
echo "   • للتحديث المستقبلي، شغّل هذا السكريبت مجدداً"
echo ""
