const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

async function safeFetch(url, parserFn, timeoutMs = 5000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { 
            headers: { 
                'User-Agent': 'NexusHub-Enterprise-Aggregator/5.0',
                'Accept': 'application/json'
            },
            signal: controller.signal 
        });
        clearTimeout(timeout);
        if (!response.ok) return [];
        const data = await response.json();
        return parserFn(data);
    } catch (err) {
        clearTimeout(timeout);
        return [];
    }
}

function sanitizeText(text, fallback = 'Unknown') {
    if (!text || typeof text !== 'string') return fallback;
    return text.trim();
}

app.get('/api/search', async (req, res) => {
    const q = sanitizeText(req.query.q, '');
    const mode = sanitizeText(req.query.mode, 'all');
    
    if (!q) {
        return res.json({ success: true, count: 0, data: { result: { scripts: [] } } });
    }

    try {
        const [scriptBloxResults, rscriptsResults] = await Promise.all([
            
            // 1. ScriptBlox Parser
            safeFetch(`https://scriptblox.com/api/script/search?q=${encodeURIComponent(q)}`, (data) => {
                const list = data.result?.scripts || data.scripts || [];
                return list.map(s => {
                    // ดึงชื่อเกม ถ้ามาเป็น Object ให้ดึง name, ถ้าไม่มีเลยให้ใช้คำค้นหาแทน
                    let gName = typeof s.game === 'object' ? s.game?.name : s.game;
                    return {
                        title: sanitizeText(s.title, 'No Title'),
                        game: sanitizeText(gName || q, 'Unknown Game'), // ใช้คำค้นหา (q) เป็นตัวสำรอง
                        script: sanitizeText(s.script, ''),
                        key: Boolean(s.key || s.isKeySystem),
                        source: 'ScriptBlox',
                        views: Number(s.views) || 0,
                        verified: Boolean(s.verified)
                    };
                });
            }),

            // 2. Rscripts Parser (แก้บั๊ก URL และ Unknown Game)
            safeFetch(`https://rscripts.net/api/v2/scripts?q=${encodeURIComponent(q)}`, (data) => {
                const list = data.scripts || data.data || [];
                return list.map(s => {
                    let gName = typeof s.game === 'object' ? s.game?.name : (s.gameTitle || s.game);
                    
                    // แก้บั๊กโค้ดเป็นลิงก์ URL
                    let code = s.script || s.code || s.rawScript || s.downloadUrl || '';
                    if (code.startsWith('http://') || code.startsWith('https://')) {
                        // ครอบด้วย loadstring ให้เอาไปรันได้จริง
                        code = `loadstring(game:HttpGet("${code}", true))()`;
                    }

                    return {
                        title: sanitizeText(s.title || s.name, 'No Title'),
                        game: sanitizeText(gName || q, 'Unknown Game'), // ใช้คำค้นหา (q) เป็นตัวสำรอง
                        script: sanitizeText(code, ''),
                        key: Boolean(s.isKey || s.keySystem || s.key),
                        source: 'Rscripts',
                        views: Number(s.views || s.click || s.downloads || s.viewCount) || 0,
                        verified: Boolean(s.verified)
                    };
                });
            })
        ]);

        let allScripts = [...scriptBloxResults, ...rscriptsResults];
        allScripts = allScripts.filter(item => item.script.length > 0);

        const uniqueMap = new Map();
        allScripts.forEach(item => {
            const keyIdentifier = item.script.replace(/\s+/g, '') || item.title;
            if (!uniqueMap.has(keyIdentifier)) {
                uniqueMap.set(keyIdentifier, item);
            }
        });
        let processedScripts = Array.from(uniqueMap.values());

        if (mode === 'no-key') processedScripts = processedScripts.filter(s => !s.key);
        else if (mode === 'has-key') processedScripts = processedScripts.filter(s => s.key);

        processedScripts.sort((a, b) => {
            if (a.verified !== b.verified) return b.verified ? 1 : -1;
            return b.views - a.views;
        });

        res.json({
            success: true,
            count: processedScripts.length,
            data: {
                result: {
                    scripts: processedScripts
                }
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, error: 'System Error' });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

app.listen(PORT, () => console.log('Nexus Hub v5.0 Fixed Server running on port ' + PORT));

