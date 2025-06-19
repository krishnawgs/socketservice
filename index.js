const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'https://jazzy-bavarois-27e7fc.netlify.app',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

app.use(cors({ origin: 'https://jazzy-bavarois-27e7fc.netlify.app', credentials: true }));
app.use(express.json());

mongoose.connect('mongodb+srv://dev:xjvcptTN8CZ0G98q@cluster0.ricqecm.mongodb.net/Healboxx')
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.error('MongoDB connection error:', err));

const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
});
const User = mongoose.model('User', userSchema);

const roomSchema = new mongoose.Schema({
    userId1: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userId2: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});
const Room = mongoose.model('Room', roomSchema);

const messageSchema = new mongoose.Schema({
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    sender: String,
    text: String,
    timestamp: String,
});
const Message = mongoose.model('Message', messageSchema);

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        console.log(`User joined room: ${roomId}`);
    });

    socket.on('sendMessage', async (message) => {
        try {
            const { roomId, sender, text, timestamp } = message;
            io.to(roomId).emit('message', message); // Broadcast to room
        } catch (error) {
            console.error('Error broadcasting message:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

app.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ name, email, password: hashedPassword });
        await user.save();
        res.status(201).send('User registered');
    } catch (error) {
        res.status(400).send('Error registering user');
    }
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).send('Invalid credentials');
        }
        res.json({ user: { _id: user._id, name: user.name, email: user.email } });
    } catch (error) {
        res.status(500).send('Error logging in');
    }
});

app.get('/search', async (req, res) => {
    try {
        const { email } = req.query;
        const user = await User.findOne({ email }).select('name email _id');
        if (!user) return res.status(404).send('User not found');
        res.json({ user });
    } catch (error) {
        res.status(500).send('Error searching user');
    }
});

app.post('/rooms', async (req, res) => {
    try {
        const { userId1, userId2 } = req.body;
        let room = await Room.findOne({
            $or: [
                { userId1, userId2 },
                { userId1: userId2, userId2: userId1 },
            ],
        });
        if (!room) {
            room = new Room({ userId1, userId2 });
            await room.save();
        }
        const messages = await Message.find({ roomId: room._id });
        res.json({ roomId: room._id, messages });
    } catch (error) {
        res.status(500).send('Error creating room');
    }
});

app.post('/messages', async (req, res) => {
    try {
        const { roomId, sender, text, timestamp } = req.body;
        const message = new Message({ roomId, sender, text, timestamp });
        await message.save();
        res.status(201).send('Message saved');
    } catch (error) {
        res.status(500).send('Error saving message');
    }
});

app.get('/', (req, res) => {
    res.send('Welcome to the Healboxx Chat API');
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});