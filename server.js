const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));

app.get('/api/search', (req, res) => {
    const q = req.query.q || '';
    res.json({
        success: true,
        data: {
            result: {
                scripts: [
                    {
                        title: 'Script for ' + q,
                        game: { name: q },
                        views: 999,
                        script: 'print("Loaded: ' + q + '");'
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
    console.log('Server is running on port ' + PORT);
});
