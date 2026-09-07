const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

// รองรับ API ค้นหาสคริปต์
app.get('/api/search', (req, res) => {
    const query = req.query.q;
    // ตัวอย่างโครงสร้างข้อมูลที่หน้าเว็บคาดหวัง
    res.json({
        source: 'cache',
        data: {
            result: {
                scripts: [
                    {
                        title: 'ตัวอย่างสคริปต์สำหรับ ' + query,
                        game: { name: query },
                        views: 1337,
                        script: 'print("Hello from Nexus Hub: ' + query + '");'
                    }
                ]
            }
        }
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log('Server running on port ' + PORT));
