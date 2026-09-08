const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// ตั้งค่า Middleware พื้นฐาน
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// ระบบ Timeout และ Fetch แบบปลอดภัย (Fault-Tolerant Fetcher)
async function safeFetch(url, parserFn, timeoutMs = 5000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
        const response = await fetch(url, { 
            headers: { 
                'User-Agent': 'NexusHub-Enterprise-Aggregator/4.0',
                'Accept': 'application/json'
            },
            signal: controller.signal 
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
            console.warn(`[Warning] API returned status ${response.status} for URL: ${url}`);
            return [];
        }
        
        const data = await response.json();
        return parserFn(data);
    } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
            console.error(`[Timeout] Request to ${url} exceeded ${timeoutMs}ms`);
        } else {
            console.error(`[Error] Fetch failed for ${url}:`, err.message);
        }
        return [];
    }
}

// ฟังก์ชันทำความสะอาดข้อความ ป้องกันโค้ดพังหรืออักษรประหลาด
function sanitizeText(text, fallback = 'Unknown') {
    if (!text || typeof text !== 'string') return fallback;
    return text.trim();
}

app.get('/api/search', async (req, res) => {
    const startTime = Date.now();
    const q = sanitizeText(req.query.q, '');
    const mode = sanitizeText(req.query.mode, 'all');
    
    if (!q) {
        return res.json({ 
            success: true, 
            source: 'Empty Query Guard',
            count: 0,
            data: { result: { scripts: [] } } 
        });
    }

    console.log(`[Search Query] Searching for: "${q}" with mode: "${mode}"`);

    try {
        // ยิงคำขอไปยัง API หลายแหล่งพร้อมกันด้วยระบบป้องกันล่ม
        const [scriptBloxResults, rscriptsResults] = await Promise.all([
            
            // แหล่งที่ 1: ScriptBlox API
            safeFetch(`https://scriptblox.com/api/script/search?q=${encodeURIComponent(q)}`, (data) => {
                const list = data.result?.scripts || data.scripts || [];
                return list.map(s => ({
                    title: sanitizeText(s.title, 'No Title'),
                    game: sanitizeText(s.game?.name || s.game, 'Unknown Game'),
                    script: sanitizeText(s.script, ''),
                    key: Boolean(s.key || s.isKeySystem),
                    source: 'ScriptBlox',
                    views: Number(s.views) || 0,
                    verified: Boolean(s.verified),
                    slug: sanitizeText(s.slug, '')
                }));
            }),

            // แหล่งที่ 2: Rscripts API
            safeFetch(`https://rscripts.net/api/v2/scripts?q=${encodeURIComponent(q)}`, (data) => {
                const list = data.scripts || data.data || [];
                return list.map(s => ({
                    title: sanitizeText(s.title || s.name, 'No Title'),
                    game: sanitizeText(s.gameTitle || s.game?.name || s.game, 'Unknown Game'),
                    script: sanitizeText(s.script || s.code || s.rawScript || s.downloadUrl, ''),
                    key: Boolean(s.isKey || s.keySystem || s.key),
                    source: 'Rscripts',
                    views: Number(s.views || s.click || s.downloads) || 0,
                    verified: Boolean(s.verified),
                    slug: sanitizeText(s._id || s.id, '')
                }))
            })
        ]);

        // รวมร่างข้อมูลทั้งหมด
        let allScripts = [...scriptBloxResults, ...rscriptsResults];

        // ระบบกรองสคริปต์ว่างเปล่า (ไม่มีโค้ดสคริปต์ให้ก๊อปปี้ ตัดทิ้งทันทีป้องกันกล่องดำ)
        allScripts = allScripts.filter(item => item.script.length > 0);

        // ระบบกรองสคริปต์ซ้ำ (Deduplication Engine)
        const uniqueMap = new Map();
        allScripts.forEach(item => {
            // ใช้โค้ดสคริปต์หรือชื่อเรื่องเป็นตัวเช็คความซ้ำ
            const keyIdentifier = item.script.replace(/\s+/g, '') || item.title;
            if (!uniqueMap.has(keyIdentifier)) {
                uniqueMap.set(keyIdentifier, item);
            }
        });
        let processedScripts = Array.from(uniqueMap.values());

        // ระบบกรองตามโหมด (All / No-Key / Has-Key)
        if (mode === 'no-key') {
            processedScripts = processedScripts.filter(s => !s.key);
        } else if (mode === 'has-key') {
            processedScripts = processedScripts.filter(s => s.key);
        }

        // ระบบจัดอันดับอัจฉริยะ (Smart Sorting): ดันตัวที่ Verified และมียอดวิวสูงขึ้นมาแสดงก่อน
        processedScripts.sort((a, b) => {
            if (a.verified !== b.verified) {
                return b.verified ? 1 : -1; // ติ๊กถูกมาก่อน
            }
            return b.views - a.views; // ยอดวิวเยอะมาก่อน
        });

        const duration = Date.now() - startTime;
        console.log(`[Success] Found ${processedScripts.length} items in ${duration}ms`);

        res.json({
            success: true,
            source: 'Enterprise Hardened Multi-Source Aggregator',
            count: processedScripts.length,
            responseTime: `${duration}ms`,
            data: {
                result: {
                    scripts: processedScripts
                }
            }
        });

    } catch (error) {
        console.error('[Fatal Error] Pipeline Crash Prevented:', error.message);
        res.status(500).json({
            success: false,
            error: 'ระบบประมวลผลขัดข้องชั่วคราว แต่ปลอดภัยไร้กังวล',
            details: error.message
        });
    }
});

// Health check endpoint สำหรับเช็คสถานะเซิร์ฟเวอร์
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ONLINE',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        memoryUsage: process.memoryUsage()
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Global Error Catchers ป้องกันเซิร์ฟเวอร์ดับกลางอากาศ
process.on('uncaughtException', (err) => {
    console.error('[Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Unhandled Rejection]:', reason);
});

app.listen(PORT, () => {
    console.log(`========================================`);
    console.log(`   NEXUS HUB ENTERPRISE SERVER v4.0     `);
    console.log(`   Running on port: ${PORT}             `);
    console.log(`========================================`);
});
