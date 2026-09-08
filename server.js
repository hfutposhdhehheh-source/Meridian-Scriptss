const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

// ฟังก์ชันดึงข้อมูลแบบแยกอิสระ ป้องกันตัวนึงล่มแล้วพังทั้งหมด
async function safeFetch(url, parserFn) {
    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'NexusHub-Bot/2.0' } });
        if (!response.ok) return [];
        const data = await response.json();
        return parserFn(data);
    } catch (err) {
        // ถ้าแหล่งนี้ล่ม ให้ข้ามไปเงียบๆ ไม่ให้ระบบล่มตาม
        return [];
    }
}

app.get('/api/search', async (req, res) => {
    const q = req.query.q || '';
    const mode = req.query.mode || 'all';
    
    if (!q.trim()) {
        return res.json({ success: true, data: { result: { scripts: [] } } });
    }

    try {
        // ยิงพร้อมกันทุกแหล่งโดยใช้ safeFetch ดักพังไว้ทุกตัว
        const [scriptBloxResults, rscriptsResults, githubResults] = await Promise.all([
            // 1. ScriptBlox Parser
            safeFetch(`https://scriptblox.com/api/script/search?q=${encodeURIComponent(q)}`, (data) => {
                const list = data.result?.scripts || data.scripts || [];
                return list.map(s => ({
                    title: s.title || 'No Title',
                    game: s.game?.name || s.game || 'Unknown Game',
                    script: s.script || '',
                    key: Boolean(s.key || s.isKeySystem),
                    source: 'ScriptBlox',
                    verified: Boolean(s.verified)
                }));
            }),

            // 2. Rscripts Parser
            safeFetch(`https://rscripts.net/api/v2/scripts?q=${encodeURIComponent(q)}`, (data) => {
                const list = data.scripts || data.data || [];
                return list.map(s => ({
                    title: s.title || s.name || 'No Title',
                    game: s.gameTitle || s.game || 'Unknown Game',
                    script: s.script || s.code || '',
                    key: Boolean(s.isKey || s.keySystem),
                    source: 'Rscripts',
                    verified: Boolean(s.verified)
                }));
            }),

            // 3. GitHub Code Parser
            safeFetch(`https://api.github.com/search/code?q=${encodeURIComponent(q)}+extension:lua`, (data) => {
                const list = data.items || [];
                return list.slice(0, 10).map(item => ({
                    title: item.name || 'GitHub Script',
                    game: q,
                    script: `loadstring(game:HttpGet("${item.html_url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')}",true))()`,
                    key: false,
                    source: 'GitHub',
                    verified: false
                }));
            })
        ]);

        // รวมร่างข้อมูลทั้งหมดเข้าด้วยกัน
        let allScripts = [...scriptBloxResults, ...rscriptsResults, ...githubResults];

        // ระบบกรองสคริปต์ซ้ำ (Deduplication) เช็คจากชื่อหรือตัวสคริปต์ที่เหมือนกันเป๊ะ
        const uniqueMap = new Map();
        allScripts.forEach(item => {
            const keyIdentifier = item.script.trim() || item.title;
            if (!uniqueMap.has(keyIdentifier)) {
                uniqueMap.set(keyIdentifier, item);
            }
        });
        let processedScripts = Array.from(uniqueMap.values());

        // กรองตามโหมด Key / No Key
        if (mode === 'no-key') {
            processedScripts = processedScripts.filter(s => !s.key);
        } else if (mode === 'has-key') {
            processedScripts = processedScripts.filter(s => s.key);
        }

        res.json({
            success: true,
            source: 'Aggregated & Hardened Multi-Source',
            count: processedScripts.length,
            data: {
                result: {
                    scripts: processedScripts
                }
            }
        });

    } catch (error) {
        console.error('Fatal Server Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'ระบบขัดข้องชั่วคราว แต่ปลอดภัยไร้กังวล'
        });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log('Nexus Hub Hardened Server running on port ' + PORT);
});
