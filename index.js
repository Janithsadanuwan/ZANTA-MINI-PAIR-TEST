const express = require('express');
const path = require('path');
const bodyParser = require("body-parser");
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 8000;

// ✅ MongoDB Connection
const MONGODB_URL = process.env.MONGODB_URL || "YOUR_MONGODB_URL_HERE"; 

if (!MONGODB_URL || MONGODB_URL === "YOUR_MONGODB_URL_HERE") {
    console.error("❌ MONGODB_URL is missing! Please set it in Environment Variables.");
} else {
    mongoose.connect(MONGODB_URL)
        .then(() => console.log('✅ MongoDB Connected Successfully'))
        .catch(err => console.error('❌ MongoDB Connection Error:', err));
}

// ✅ Middlewares
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// HTML, CSS, Images තියෙන Root Folder එක පාවිච්චි කරන්න
app.use(express.static(path.join(__dirname, '/'))); 

// ✅ Routes Importing
const codeRouter = require('./pair'); 
const qrRouter = require('./qr');     

// ✅ API Route Registration
app.use('/code', codeRouter);
app.use('/qr', qrRouter);

// ✅ Page Navigation Routes

// 1. මුලින්ම පේන පිටුව (ඔයාගේ බටන් දෙක තියෙන index.html එක)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); 
});

// 2. Pairing Code එක ගහන පේජ් එකට යන්න
app.get('/pair-page', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

// 3. QR Code එක පෙන්වන පේජ් එකට යන්න
app.get('/qr-page', (req, res) => {
    res.sendFile(path.join(__dirname, 'qr.html'));
});

// ✅ Server Start
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
      🧬 ZANTA-MD OFFICIAL WEB SERVER
      🚀 Started on Port: ${PORT}
      ✅ Status: Online
╚════════════════════════════════════════════╝
    `);
});
