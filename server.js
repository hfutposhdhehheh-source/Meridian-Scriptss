const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('/api/search', (req, res) => {
    const q = (req.query.q || '').toLowerCase();
    
    // รายการสคริปต์ตัวอย่างในระบบ
    const allScripts = [
        { title: 'Aimbot Pro Script for ' + (q || 'General'), game: { name: q || 'Roblox' }, views: 1250, script: 'print("Running Aimbot");' },
        { title: 'Btools & Fly Exploit', game: { name: 'Roblox' }, views: 3420, script: 'print("Fly enabled");' },
        { title: 'Auto Farm GUI v2', game: { name: q || 'Blox Fruits' }, views: 8900, script: 'while true do task.wait() print("farming") end;' }
    ];

    // ค้นหาข้อมูลตามคำที่พิมพ์ หรือแสดงทั้งหมดถ้าไม่ได้พิมพ์
    const filtered = q ? allScripts.filter(s => s.title.toLowerCase().includes(q) || s.game.name.toLowerCase().includes(q)) : allScripts;

    res.json({
        success: true,
        data: {
            result: {
                scripts: filtered.length > 0 ? filtered : [
                    { title: 'Script for ' + q, game: { name: q }, views: 999, script: 'print("Loaded: ' + q + '");' }
                ]
            }
        }
    });
});

// ใช้เส้นทางแบบระบุหน้าแรก ปลอดภัย ไม่ติด PathError ปัญหาเครื่องหมาย *
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log('Server is running on port ' + PORT);
});
