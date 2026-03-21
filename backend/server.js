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
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static('uploads'));

// Rate limiting
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 }));

// ── Routes ──
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/classrooms', require('./routes/classrooms'));
app.use('/api/ai', require('./routes/ai'));

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

const start = async () => {
    await connectDB();
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🚀 E-Learning Backend running on port ${PORT}`);
        console.log(`📡 API: http://192.168.88.175:${PORT}/api`);
        console.log(`🔌 WebSocket: ws://192.168.88.152:${PORT}`);
        console.log(`🤖 AI Vision:  ${process.env.AI_VISION_URL}`);
        console.log(`🎙️  AI Voice:   ${process.env.AI_VOICE_URL}`);
        console.log(`📚 AI Recommend: ${process.env.AI_RECOMMEND_URL}\n`);
    });
};

start().catch(console.error);
