const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('/api/search', async (req, res) => {
    const q = req.query.q || '';
    const mode = req.query.mode || 'all';
    
    try {
        const apiResponse = await fetch(`https://scriptblox.com/api/script/search?q=${encodeURIComponent(q)}`);
        const data = await apiResponse.json();
        
        // ป้องกันเคสที่โครงสร้าง API เปลี่ยนแปลงหรือไม่เจอ scripts
        let scripts = [];
        if (data.result && Array.isArray(data.result.scripts)) {
            scripts = data.result.scripts;
        } else if (data.scripts && Array.isArray(data.scripts)) {
            scripts = data.scripts;
        }

        if (mode === 'no-key') {
            scripts = scripts.filter(s => !s.key && !s.isKeySystem);
        } else if (mode === 'has-key') {
            scripts = scripts.filter(s => s.key || s.isKeySystem);
        }

        res.json({
            success: true,
            source: 'API',
            data: {
                result: {
                    scripts: scripts
                }
            }
        });
    } catch (error) {
        console.error('API Fetch Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'ไม่สามารถดึงข้อมูลจาก ScriptBlox ได้ในขณะนี้'
        });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log('Server is running on port ' + PORT);
});
