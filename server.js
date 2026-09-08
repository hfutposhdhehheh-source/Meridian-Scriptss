const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

async function safeFetch(url, parserFn) {
    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'NexusHub-Bot/3.0' } });
        if (!response.ok) return [];
        const data = await response.json();
        return parserFn(data);
    } catch (err) {
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
        const [scriptBloxResults, rscriptsResults] = await Promise.all([
            // 1. ScriptBlox Parser (ดึงครบทุกฟิลด์ตามโครงสร้างจริง)
            safeFetch(`https://scriptblox.com/api/script/search?q=${encodeURIComponent(q)}`, (data) => {
                const list = data.result?.scripts || data.scripts || [];
                return list.map(s => ({
                    title: s.title || 'No Title',
                    game: s.game?.name || s.game || 'Unknown Game',
                    script: s.script || '',
                    key: Boolean(s.key || s.isKeySystem),
                    source: 'ScriptBlox',
                    views: s.views || 0,
                    verified: Boolean(s.verified)
                }));
            }),

            // 2. Rscripts Parser (ดึงครบทุกฟิลด์ ป้องกันกล่องดำและค่าว่าง)
            safeFetch(`https://rscripts.net/api/v2/scripts?q=${encodeURIComponent(q)}`, (data) => {
                const list = data.scripts || data.data || [];
                return list.map(s => ({
                    title: s.title || s.name || 'No Title',
                    game: s.gameTitle || s.game?.name || s.game || 'Unknown Game',
                    script: s.script || s.code || s.rawScript || s.downloadUrl || '',
                    key: Boolean(s.isKey || s.keySystem || s.key),
                    source: 'Rscripts',
                    views: s.views || s.click || s.downloads || 0,
                    verified: Boolean(s.verified)
                }));
            })
        ]);

        let allScripts = [...scriptBloxResults, ...rscriptsResults];

        // ระบบกรองสคริปต์ซ้ำ (Deduplication)
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
            source: 'Verified Multi-Source Aggregator',
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
            error: 'ระบบขัดข้องชั่วคราว'
        });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log('Nexus Hub Server running on port ' + PORT);
});

