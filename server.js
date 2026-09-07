const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

// API สำหรับค้นหาและกรองสคริปต์
app.get('/api/search', async (req, res) => {
    const q = req.query.q || '';
    const mode = req.query.mode || 'all'; // ค่าเริ่มต้นเป็น 'all' (ทั้งหมด)
    
    try {
        const apiResponse = await fetch(`https://scriptblox.com/api/script/search?q=${encodeURIComponent(q)}`);
        const data = await apiResponse.json();
        
        let scripts = data.result?.scripts || [];

        // กรองตามเงื่อนไข คีย์ / ไม่มีคีย์
        if (mode === 'no-key') {
            scripts = scripts.filter(s => !s.key && !s.isKeySystem);
        } else if (mode === 'has-key') {
            scripts = scripts.filter(s => s.key || s.isKeySystem);
        }

        res.json({
            success: true,
            data: {
                ...data.result,
                scripts: scripts
            }
        });
    } catch (error) {
        console.error('API Fetch Error:', error.message);
        res.status(500).json({
            success: false,
            message: 'ไม่สามารถดึงข้อมูลจาก ScriptBlox ได้ในขณะนี้'
        });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log('Server is running on port ' + PORT);
});
