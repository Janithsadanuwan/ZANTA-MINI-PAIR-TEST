const express = require("express");
const fs = require("fs");
const mongoose = require("mongoose");
const pino = require("pino");
const { makeid } = require("./gen-id");

const {
default: makeWASocket,
useMultiFileAuthState,
delay,
makeCacheableSignalKeyStore,
Browsers,
jidNormalizedUser
} = require("@whiskeysockets/baileys");

const router = express.Router();

/* ---------------- SESSION SCHEMA ---------------- */

const SessionSchema = new mongoose.Schema({
number: { type:String, unique:true },
creds: Object,
added_at:{ type:Date, default:Date.now }
});

const Session = mongoose.models.Session || mongoose.model("Session", SessionSchema);


/* ---------------- DELETE SESSION FILE ---------------- */

function removeFile(FilePath){
if(fs.existsSync(FilePath)){
fs.rmSync(FilePath,{recursive:true,force:true});
}
}


/* ---------------- PAIR ROUTE ---------------- */

router.get("/", async(req, res) => {

const id = makeid();
let num = req.query.number;

if(!num){
return res.send({ code: "❌ Number Missing" });
}

// Clean the number - remove non-digits
num = num.replace(/[^0-9]/g, "");

async function startPair(){

const { state, saveCreds } = await useMultiFileAuthState(`./session${id}`);

try{

const sock = makeWASocket({
auth:{
creds: state.creds,
keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" }))
},
printQRInTerminal: false,
logger: pino({ level: "fatal" }).child({ level: "fatal" }),
browser: Browsers.ubuntu("Chrome"),
});

sock.ev.on("creds.update", saveCreds);

// Wait for socket to be ready then request pairing code
if(!sock.authState.creds.registered){
await delay(1500);
num = num.replace(/\D/g, "");
const code = await sock.requestPairingCode(num);
const formattedCode = code?.match(/.{1,4}/g)?.join("-") || code;
if(!res.headersSent){
res.json({ code: formattedCode });
}
}

/* ---------------- CONNECTION UPDATE ---------------- */

sock.ev.on("connection.update", async(update) => {

const { connection, lastDisconnect } = update;

if(connection === "open"){

await delay(2000);

try{

const auth_path = `./session${id}/creds.json`;
const session = JSON.parse(fs.readFileSync(auth_path));

const user_jid = jidNormalizedUser(sock.user.id);

/* -------- SAVE SESSION TO MONGODB -------- */

await Session.findOneAndUpdate(
{ number: user_jid },
{ number: user_jid, creds: session },
{ upsert: true }
);

console.log("✅ Session saved to MongoDB");

/* -------- SUCCESS MESSAGE -------- */

const success_msg = `╔══════════════════╗
✨ ZANTA-MD CONNECTED ✨
╚══════════════════╝

🚀 Status : Connected
👤 User : ${user_jid.split("@")[0]}
🗄 Database : MongoDB

Your session is securely saved.

Powered by Zanta OFC`;

await sock.sendMessage(user_jid, { text: success_msg });

} catch(err){
console.log("❌ Save Error", err);
}

await delay(2000);
removeFile(`./session${id}`);
process.exit(0);

}

else if(connection === "close"){

if(lastDisconnect?.error?.output?.statusCode !== 401){
await delay(10000);
startPair();
}

}

});

} catch(err){
console.log("❌ Pair Error:", err);
removeFile(`./session${id}`);
if(!res.headersSent){
res.json({ code: "❌ Error getting code, try again" });
}
}

}

startPair();

});

module.exports = router;
