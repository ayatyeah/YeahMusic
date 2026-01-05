const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const app = express();

app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// --- НАСТРОЙКА ЗАГРУЗКИ ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const folder = req.headers['playlist-name'] || 'ДРУГОЕ';
        const dir = path.join(__dirname, 'uploads', folder);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Если это обложка (по header), называем её cover.jpg
        if (req.headers['is-cover'] === 'true') {
            cb(null, 'cover.jpg');
        } else {
            // Иначе (песня) оставляем оригинальное имя
            file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
            cb(null, file.originalname);
        }
    }
});
const upload = multer({ storage: storage });

// --- API ---

// 1. ПОЛУЧИТЬ ПЛЕЙЛИСТЫ + ОБЛОЖКИ
app.get('/api/playlists', (req, res) => {
    const uploadsDir = path.join(__dirname, 'uploads');
    const result = {};

    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

    const folders = fs.readdirSync(uploadsDir);
    folders.forEach(folder => {
        const folderPath = path.join(uploadsDir, folder);
        if (fs.statSync(folderPath).isDirectory()) {
            const files = fs.readdirSync(folderPath);
            const mp3s = files.filter(f => f.endsWith('.mp3')).map(f => ({ file: `uploads/${folder}/${f}` }));
            
            // Проверяем, есть ли обложка
            const hasCover = files.includes('cover.jpg');
            
            result[folder] = {
                tracks: mp3s,
                cover: hasCover ? `uploads/${folder}/cover.jpg` : null
            };
        }
    });
    res.json(result);
});

// 2. СОЗДАТЬ ПЛЕЙЛИСТ
app.post('/api/create-playlist', (req, res) => {
    const { name } = req.body;
    if (!name) return res.json({ success: false });
    const safeName = name.replace(/[^a-zа-яё0-9\s-]/gi, '').trim();
    const dir = path.join(__dirname, 'uploads', safeName);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        res.json({ success: true });
    } else {
        res.json({ success: false, error: 'Exists' });
    }
});

// 3. ПЕРЕМЕСТИТЬ ПЕСНЮ
app.post('/api/move-song', (req, res) => {
    const { filename, fromPlaylist, toPlaylist } = req.body;
    const oldPath = path.join(__dirname, 'uploads', fromPlaylist, filename);
    const newPath = path.join(__dirname, 'uploads', toPlaylist, filename);
    if (fs.existsSync(oldPath)) {
        fs.rename(oldPath, newPath, (err) => {
            if (err) return res.json({ success: false });
            res.json({ success: true });
        });
    } else res.json({ success: false });
});

// 4. ЗАГРУЗКА ПЕСНИ ИЛИ ОБЛОЖКИ
// Используем тот же маршрут, но логика внутри storage (см. выше) решит, как назвать файл
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    res.json({ success: true });
});

// 5. ТЕКСТЫ
app.get('/api/lyrics/:filename', (req, res) => {
    const dir = path.join(__dirname, 'lyrics');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const filePath = path.join(dir, req.params.filename + '.txt');
    if (fs.existsSync(filePath)) res.json({ found: true, text: fs.readFileSync(filePath, 'utf8') });
    else res.json({ found: false });
});

app.post('/api/save-lyrics', (req, res) => {
    const { filename, text } = req.body;
    const dir = path.join(__dirname, 'lyrics');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    const filePath = path.join(dir, filename + '.txt');
    fs.writeFile(filePath, text, () => res.json({ success: true }));
});

app.listen(3000, () => {
    console.log('SERVER READY: http://localhost:3000');
});