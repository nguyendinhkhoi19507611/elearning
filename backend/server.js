require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Store io instance for routes
app.set('io', io);

// ── Middleware ──
app.use(cors());
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploads with proper headers for video playback & download
app.use('/uploads', (req, res, next) => {
    // Cho phép browser phát video và tải file
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Nếu là file recordings, set Content-Type đúng
    if (req.path.includes('/recordings/') && req.path.endsWith('.webm')) {
        res.setHeader('Content-Type', 'video/webm');
    }
    next();
}, express.static('uploads'));

// Rate limiting
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 }));

// ── Routes ──
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/classrooms', require('./routes/classrooms'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/assignments', require('./routes/assignments')); // [D3]

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok', service: 'elearning-backend',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ── WebSocket ──
require('./socket/socketHandler')(io);

// ── Error handler ──
app.use((err, req, res, next) => {
    console.error('❌', err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// ── Start ──
const PORT = process.env.PORT || 5000;

// [BUG-13 FIX] Dynamic IP detection thay vì hard-coded
const os = require('os');
function getLocalIP() {
    const nets = os.networkInterfaces();
    for (const iface of Object.values(nets)) {
        for (const net of iface) {
            if (net.family === 'IPv4' && !net.internal) return net.address;
        }
    }
    return 'localhost';
}

const start = async () => {
    await connectDB();
    const localIP = getLocalIP();
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🚀 E-Learning Backend running on port ${PORT}`);
        console.log(`📡 API: http://${localIP}:${PORT}/api`);
        console.log(`🔌 WebSocket: ws://${localIP}:${PORT}`);
        console.log(`🤖 AI Vision:  ${process.env.AI_VISION_URL}`);
        console.log(`🎙️  AI Voice:   ${process.env.AI_VOICE_URL}`);
        console.log(`📚 AI Recommend: ${process.env.AI_RECOMMEND_URL}\n`);
    });
};

start().catch(console.error);
