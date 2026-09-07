const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;

// ตั้งค่า Cache เก็บผลลัพธ์ไว้ 5 นาที (300 วินาที) เพื่อลดภาระการยิง API ซ้ำๆ
const scriptCache = new NodeCache({ stdTTL: 300 });

// 1. ระบบ Security Headers ป้องกันช่องโหว่เว็บเบื้องต้น
app.use(helmet());

// 2. อนุญาต CORS (ให้หน้าบ้านเชื่อมต่อเข้ามาได้)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// 3. ระบบ Rate Limiter ป้องกันการสแปมหรือยิงถล่ม (จำกัด 30 รีเควสต่อ 1 นาทีต่อ IP)
const searchLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 นาที
    max: 30, // จำกัด 30 ครั้ง
    message: { error: 'คุณส่งคำขอเร็วเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง' },
    standardHeaders: true,
    legacyHeaders: false,
});

// เส้นทางค้นหาสคริปต์พร้อมระบบป้องกัน
app.get('/api/search', searchLimiter, async (req, res) => {
    let query = req.query.q;

    // ตรวจสอบและกรองค่าความปลอดภัยเบื้องต้น
    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'กรุณาระบุชื่อเกมหรือสคริปต์ที่ต้องการค้นหา' });
    }

    query = query.trim().substring(0, 100); // ตัดความยาวไม่ให้เกิน 100 ตัวอักษรป้องกันพวกยิงยาวๆ มาป่วน
    const cacheKey = `search_${query.toLowerCase()}`;

    // เช็กว่ามีข้อมูลใน Cache หรือยัง ถ้ามีดึงจากเครื่องเราได้เลย ไวโคตรๆ
    if (scriptCache.has(cacheKey)) {
        return res.json({
            source: 'cache',
            data: scriptCache.get(cacheKey)
        });
    }

    try {
        const response = await fetch(`https://scriptblox.com/api/script/search?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            return res.status(502).json({ error: 'ไม่สามารถติดต่อกับแหล่งข้อมูลสคริปต์ได้ในขณะนี้' });
        }

        const data = await response.json();
        
        // บันทึกลง Cache เก็บไว้
        scriptCache.set(cacheKey, data);

        res.json({
            source: 'api',
            data: data
        });

    } catch (error) {
        console.error('Search Error:', error.message);
        res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
    }
});

// จัดการกรณีเข้าหน้าเว็บผิด URL
app.use((req, res) => {
    res.status(404).json({ error: 'ไม่พบเส้นทางที่คุณต้องการ' });
});

app.listen(PORT, () => {
    console.log(`[Secure Server] Backend is running and protected on port ${PORT}`);
});

