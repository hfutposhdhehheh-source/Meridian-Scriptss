const express = require('express');
const path = require('path');
const axios = require('axios'); // ต้องแน่ใจว่าติดตั้ง axios หรือใช้ fetch ในตัว Node.js ได้เลย
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

// เชื่อมต่อ API จริงของ ScriptBlox
app.get('/api/search', async (req, res) => {
    const q = req.query.q || '';
    try {
        // ยิง request ไปที่ API ค้นหาสคริปต์ของ ScriptBlox
        const response = await axios.get(`https://scriptblox.com/api/script/search?q=${encodeURIComponent(q)}`);
        
        // ส่งผลลัพธ์ข้อมูลดิบจาก ScriptBlox กลับไปให้หน้าเว็บของคุณ
        res.json({
            success: true,
            data: response.data
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

