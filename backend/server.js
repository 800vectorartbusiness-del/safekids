// ========= IMPORTS =========
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// ========= INIT =========
const app = express();
const PORT = process.env.PORT || 5000;

// ========= MIDDLEWARE =========
app.use(cors());
app.use(express.json());

// ========= STATIC FOLDER =========
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========= HTTP + SOCKET =========
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" }
});

// ========= SOCKET CONNECTION =========
io.on('connection', (socket) => {
    console.log("🟢 User connected:", socket.id);

    socket.on('disconnect', () => {
        console.log("🔴 User disconnected:", socket.id);
    });
});

// ========= MONGODB CONNECT =========
mongoose.connect('mongodb+srv://sosApp_db_user:n9be14MWm5GN0jzq@cluster1.yeltker.mongodb.net/sosApp?retryWrites=true&w=majority&appName=Cluster1')
.then(() => console.log('✅ MongoDB Atlas Connected'))
.catch(err => console.error('❌ Error:', err));

// ========= SCHEMA =========
const mediaSchema = new mongoose.Schema({
    filename: String,
    path: String,
    lat: String,
    lng: String,
    uploadedAt: {
        type: Date,
        default: Date.now
    }
});

const Media = mongoose.model('Media', mediaSchema);

// ========= MULTER SETUP =========
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage: storage });

app.get("/", (req, res) => {
    res.send("🚀 Safe Kids Fast Server Running Successfully");
});

// ========= ROUTES =========

// 🔥 Upload API + REALTIME + DB SAVE
app.post('/upload', upload.array('files'), async (req, res) => {
    try {
        const files = req.files;
        const { lat, lng } = req.body;

        if (!files || files.length === 0) {
            return res.status(400).json({ error: "No files uploaded" });
        }

        console.log("📍 LOCATION RECEIVED:", lat, lng);

        // 📸 File URLs
        const fileUrls = files.map(f => 
            `https://safekidsfast.onrender.com/uploads/${f.filename}`
        );

        // 💾 SAVE TO MONGODB
        for (let file of files) {
            await Media.create({
                filename: file.filename,
                path: file.path,
                lat,
                lng
            });
        }

        // 🔥 REALTIME SEND
        io.emit('receive-media', {
            files: fileUrls,
            location: { lat, lng }
        });

        console.log("🔥 Sent realtime");

        res.json({
            success: true,
            files: fileUrls,
            location: { lat, lng }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Upload failed" });
    }
});

// 🔥 Get all uploads
app.get('/media', async (req, res) => {
    try {
        const media = await Media.find().sort({ uploadedAt: -1 });
        res.json(media);
    } catch (err) {
        res.status(500).json({ error: 'Fetch failed' });
    }
});

// ========= SERVER START =========
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
