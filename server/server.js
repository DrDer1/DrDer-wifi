const express = require('express');
const cors = require('cors');
const os = require('os');
const net = require('net');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());

function execCommand(command, timeout = 5000) {
    return new Promise((resolve) => {
        exec(command, { timeout }, (error, stdout) => {
            resolve(stdout || '');
        });
    });
}

function getVendor(mac) {
    if (!mac) return null;

    const cleaned = mac.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();

    if (cleaned.length < 6) return null;

    const oui = cleaned.substring(0, 6);

    const db = {
        FCA386: 'آبل',
        B07994: 'آبل',
        A45E60: 'آبل',

        '001CDF': 'سامسونج',
        '8C8590': 'سامسونج',
        CC05E8: 'سامسونج',

        F02765: 'هواوي',
        '48DB50': 'هواوي',
        '105B63': 'هواوي',

        '04F13E': 'شاومي',
        '64A5C3': 'شاومي',
        '8C3F4F': 'شاومي',

        DC4F22: 'أوبو',
        D4E6B7: 'فيفو',
        '78D9E9': 'ريلمي',

        '0016EA': 'إنتل',
        A41F72: 'إنتل',

        BC5FF4: 'إل جي',
        '001F48': 'سوني',

        '0022D7': 'لينوفو',

        '0017C4': 'TP-Link',
        '14CC20': 'TP-Link',
        '50C7BF': 'TP-Link',

        '000D88': 'D-Link',

        '0023CD': 'ASUS',

        '0023B1': 'HP',

        '00037F': 'Dell',

        '001F33': 'Cisco',

        B827EB: 'Raspberry Pi',

        C4B301: 'Nokia'
    };

    return db[oui] || null;
}

async function getNetworkInfo() {

    const info = {
        localIp: null,
        gateway: null,
        subnetMask: null,
        interface: null,
        ssid: null
    };

    const interfaces = os.networkInterfaces();

    for (const iface in interfaces) {

        for (const addr of interfaces[iface]) {

            if (
                addr.family === 'IPv4' &&
                !addr.internal
            ) {

                info.localIp = addr.address;
                info.subnetMask = addr.netmask;
                info.interface = iface;

                break;
            }

        }

        if (info.localIp) break;

    }

    if (info.localIp) {

        const p = info.localIp.split('.');

        info.gateway =
            `${p[0]}.${p[1]}.${p[2]}.1`;

    }

    try {

        const out = await execCommand(
            'termux-wifi-connectioninfo 2>/dev/null'
        );

        if (out) {

            const json = JSON.parse(out);

            if (json.ssid)
                info.ssid = json.ssid;

        }

    } catch {}

    if (!info.ssid) {

        try {

            const out = await execCommand(
                'dumpsys wifi 2>/dev/null'
            );

            const m =
                out.match(/SSID[:=]\s*"?([^"\n,]+)"?/);

            if (m)
                info.ssid = m[1];

        } catch {}

    }

    return info;

}

function ping(ip) {

    return new Promise((resolve) => {

        exec(
            `ping -c 1 -W 1 ${ip}`,
            { timeout: 2000 },
            (err) => {

                resolve(!err);

            }
        );

    });

}

function checkPort(ip, port) {

    return new Promise((resolve) => {

        const socket = new net.Socket();

        let finished = false;

        socket.setTimeout(800);

        socket.on('connect', () => {

            finished = true;

            socket.destroy();

            resolve(true);

        });

        socket.on('timeout', () => {

            if (!finished) {

                finished = true;

                socket.destroy();

                resolve(false);

            }

        });

        socket.on('error', () => {

            if (!finished) {

                finished = true;

                resolve(false);

            }

        });

        socket.connect(port, ip);

    });

}

const COMMON_PORTS = [
    80,
    443,
    22,
    53,
    445,
    8080,
    5555
];
async function scanHost(ip) {

    const alive = await ping(ip);

    if (!alive) {
        return null;
    }

    let openPorts = [];

    await Promise.all(

        COMMON_PORTS.map(async (port) => {

            const opened = await checkPort(ip, port);

            if (opened) {
                openPorts.push(port);
            }

        })

    );

    let hostname = null;

    try {

        const out = await execCommand(
            `getent hosts ${ip}`
        );

        if (out.trim()) {

            const parts = out.trim().split(/\s+/);

            if (parts.length >= 2) {
                hostname = parts[1];
            }

        }

    } catch {}

    let mac = null;

    try {

        const out = await execCommand(
            `busybox arp -n ${ip} 2>/dev/null`
        );

        const m = out.match(
            /([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}/
        );

        if (m) {

            mac = m[0]
                .toUpperCase()
                .replace(/-/g, ':');

        }

    } catch {}

    let type = "جهاز";

    if (ip.endsWith(".1")) {

        type = "راوتر";

    } else if (
        openPorts.includes(5555)
    ) {

        type = "أندرويد";

    } else if (
        openPorts.includes(445)
    ) {

        type = "ويندوز";

    } else if (
        openPorts.includes(22)
    ) {

        type = "لينكس";

    } else if (
        openPorts.includes(80) ||
        openPorts.includes(443)
    ) {

        type = "جهاز شبكة";

    }

    return {

        ip,

        mac,

        vendor: getVendor(mac),

        name: hostname,

        type,

        openPorts,

        online: true,

        lastSeen: Date.now()

    };

}

async function scanNetwork() {

    const info = await getNetworkInfo();

    if (!info.localIp) {

        return {
            networkInfo: info,
            devices: []
        };

    }

    const p = info.localIp.split(".");

    const prefix =
        `${p[0]}.${p[1]}.${p[2]}`;

    const jobs = [];

    for (let i = 1; i <= 254; i++) {

        jobs.push(scanHost(`${prefix}.${i}`));

    }

    const result =
        await Promise.all(jobs);

    const devices =
        result.filter(Boolean);

    devices.sort((a, b) => {

        const pa =
            a.ip.split(".").map(Number);

        const pb =
            b.ip.split(".").map(Number);

        for (let i = 0; i < 4; i++) {

            if (pa[i] !== pb[i]) {

                return pa[i] - pb[i];

            }

        }

        return 0;

    });

    return {

        networkInfo: info,

        devices

    };

}

app.get("/", (req, res) => {

    res.json({

        name: "DrDer-WiFi Server",

        version: "2.0.0",

        status: "running"

    });

});

app.get(
    "/api/network/info",
    async (req, res) => {

        const info =
            await getNetworkInfo();

        res.json({

            success: true,

            data: info

        });

    }
);

app.get(
    "/api/network/scan",
    async (req, res) => {

        try {

            const result =
                await scanNetwork();

            res.json({

                success: true,

                data: result.devices,

                count:
                    result.devices.length,

                networkInfo:
                    result.networkInfo

            });

        } catch (e) {

            res.json({

                success: false,

                error: e.message,

                data: []

            });

        }

    }
);
app.get("/api/devices", async (req, res) => {

    try {

        const result = await scanNetwork();

        res.json({

            success: true,

            data: result.devices,

            count: result.devices.length

        });

    } catch (e) {

        res.json({

            success: false,

            error: e.message,

            data: []

        });

    }

});

app.post("/api/devices/disconnect", async (req, res) => {

    const { ip } = req.body;

    if (!ip) {

        return res.json({

            success: false,

            message: "عنوان IP مطلوب"

        });

    }

    return res.json({

        success: false,

        message:
            "قطع اتصال الأجهزة غير مدعوم على Android/Termux بدون صلاحيات Root."

    });

});

app.get("/api/health", (req, res) => {

    res.json({

        success: true,

        status: "ok",

        uptime: process.uptime(),

        memory: process.memoryUsage(),

        platform: process.platform,

        node: process.version

    });

});

app.use((req, res) => {

    res.status(404).json({

        success: false,

        message: "المسار غير موجود"

    });

});

app.listen(PORT, "127.0.0.1", () => {

    console.log("");

    console.log("======================================");

    console.log("DrDer-WiFi Server");

    console.log("Version 2.0.0");

    console.log("Listening on:");

    console.log(`http://127.0.0.1:${PORT}`);

    console.log(`http://localhost:${PORT}`);

    console.log("======================================");

    console.log("");

});
