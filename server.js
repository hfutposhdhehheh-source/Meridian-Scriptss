const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/api/search', (req, res) => {
    res.json({
        success: true,
        data: {
            result: {
                scripts: [
                    {
                        title: 'Test Script',
                        game: { name: req.query.q || 'test' },
                        views: 100,
                        script: 'print("OK");'
                    }
                ]
            }
        }
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
