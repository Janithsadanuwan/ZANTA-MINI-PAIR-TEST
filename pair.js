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

/* ---------------- MONGODB CONNECT ---------------- */

mongoose.connect(process.env.MONGODB_URL,{
useNewUrlParser: true,
useUnifiedTopology: true
})
.then(()=> console.log("✅ MongoDB Connected"))
.catch(err => console.log("❌ MongoDB Error:",err));


/* ---------------- SESSION SCHEMA ---------------- */

const SessionSchema = new mongoose.Schema({
number: { type:String, unique:true },
creds: Object,
added_at:{ type:Date, default:Date.now }
});

const Session = mongoose.models.Session || mongoose.model("Session", SessionSchema);


/* ---------------- DELETE SESSION FILE ---------------- */

function removeFile(path){
if(fs.existsSync(path)){
fs.rmSync(path,{recursive:true,force:true});
}
}


/* ---------------- PAIR ROUTE ---------------- */

router.get("/", async(req,res)=>{

const id = makeid();
let num = req.query.number;

if(!num){
return res.send("❌ Number Missing");
}

async function startPair(){

const { state, saveCreds } = await useMultiFileAuthState(`./session${id}`);

try{

const sock = makeWASocket({

auth:{
creds: state.creds,
keys: makeCacheableSignalKeyStore(state.keys,pino({level:"fatal"}))
},

printQRInTerminal:false,
browser: Browsers.macOS("Safari")

});

sock.ev.on("creds.update", saveCreds);


/* ---------------- CONNECTION UPDATE ---------------- */

sock.ev.on("connection.update", async(update)=>{

const {connection,lastDisconnect} = update;

if(connection === "open"){

await delay(2000);

try{

const auth_path = `./session${id}/creds.json`;
const session = JSON.parse(fs.readFileSync(auth_path));

const user_jid = jidNormalizedUser(sock.user.id);


/* -------- SAVE SESSION TO MONGODB -------- */

await Session.findOneAndUpdate(
{ number:user_jid },
{
number:user_jid,
creds:session
},
{upsert:true}
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

await sock.sendMessage(user_jid,{text:success_msg});

}catch(err){

console.log("❌ Save Error",err);

}

await delay(2000);

removeFile(`./session${id}`);

process.exit(0);

}


/* ---------------- RECONNECT ---------------- */

else if(connection === "close"){

if(lastDisconnect?.error?.output?.statusCode !== 401){

await delay(10000);
startPair();

}

}

});

}catch(err){

console.log("❌ Pair Error:",err);
startPair();

}

}

startPair();

});

module.exports = router;