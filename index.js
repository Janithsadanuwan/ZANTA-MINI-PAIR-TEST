const express = require('express');
const path = require('path');
const bodyParser = require("body-parser");
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 8000;

// ✅ MongoDB Connection
const MONGODB_URL = process.env.MONGODB_URL || "ඔයාගේ_mongodb_url_එක_මෙතන_දාන්න"; 

if (!MONGODB_URL) {
    console.error("❌ MONGODB_URL is missing in environment variables!");
} else {
    mongoose.connect(MONGODB_URL)
        .then(() => console.log('✅ MongoDB Connected Successfully'))
        .catch(err => console.error('❌ MongoDB Connection Error:', err));
}

// ✅ Middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Static Files (HTML, CSS, JS තියෙන ෆෝල්ඩර් එක)
app.use(express.static(path.join(__dirname, 'public'))); 
// සටහන: ඔයාගේ html ෆයිල්ස් තියෙන්නේ වෙනම ෆෝල්ඩර් එකක නම් ඒ නම දෙන්න.

// ✅ Routes Importing
let codeRouter = require('./pair'); // Pairing Code සඳහා
let qrRouter = require('./qr');     // QR Code සඳහා

// ✅ Route Registration
app.use('/code', codeRouter);
app.use('/qr', qrRouter);

// ✅ Page Navigation
// Main Page (අර බටන් දෙක තියෙන එක)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); 
});

// Pairing Code Page
app.get('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

// QR Code Page
app.get('/qr-link', (req, res) => {
    res.sendFile(path.join(__dirname, 'qr.html'));
});

// ✅ Server Start
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
     🚀 ZANTA-MD WEB SERVER STARTED
     🌐 Port: ${PORT}
     ✅ Status: Online
╚═══════════════════════════════════════════╝
    `);
});
