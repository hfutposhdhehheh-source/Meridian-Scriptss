const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

// เชื่อมต่อ API ของ ScriptBlox โดยใช้ fetch ในตัว Node.js
app.get('/api/search', async (req, res) => {
    const q = req.query.q || '';
    try {
        const apiResponse = await fetch(`https://scriptblox.com/api/script/search?q=${encodeURIComponent(q)}`);
        const data = await apiResponse.json();
        
        res.json({
            success: true,
            data: data
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

