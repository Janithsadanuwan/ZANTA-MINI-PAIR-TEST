const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");
const mongoose = require("mongoose");
let router = express.Router();
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  Browsers,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");

// MongoDB Session Schema
const SessionSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  creds: { type: Object, required: true },
  added_at: { type: Date, default: Date.now }
});
const Session = mongoose.models.Session || mongoose.model("Session", SessionSchema);

// ✅ බලෙන්ම මකන්න පුළුවන් වෙන්න හදපු removeFile එක
function removeFile(FilePath) {
  if (!fs.existsSync(FilePath)) return false;
  fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get("/", async (req, res) => {
  let num = req.query.number;
  
  async function RobinPair() {
    // 1. කලින් ඉතිරි වෙච්ච පරණ ෆයිල් මොනවා හරි තිබ්බොත් අලුත් එකට කලින් ඒවා මකනවා (Safety First)
    removeFile("./session");

    const { state, saveCreds } = await useMultiFileAuthState(`./session`);
    
    try {
      let RobinPairWeb = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(
            state.keys,
            pino({ level: "fatal" }).child({ level: "fatal" })
          )
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }).child({ level: "fatal" }),
        // ✅ Safari වෙනුවට Ubuntu Chrome දැම්මා (More Stable for linking)
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
      });

      if (!RobinPairWeb.authState.creds.registered) {
        await delay(1500);
        num = num.replace(/[^0-9]/g, "");
        const code = await RobinPairWeb.requestPairingCode(num);
        
        if (!res.headersSent) {
          await res.send({ code });
        }

        // ✅ විනාඩි 3 කින් session එක Auto Delete කරන Timer එක (180,000 ms)
        // යූසර් ලින්ක් කළත් නැතත් විනාඩි 3 කින් සර්වර් එක Clean වෙනවා
        setTimeout(() => {
          if (fs.existsSync("./session")) {
            removeFile("./session");
            console.log("🕒 3 Minutes Timeout: Session files deleted for security.");
          }
        }, 180000); 
      }

      RobinPairWeb.ev.on("creds.update", saveCreds);
      RobinPairWeb.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        
        if (connection === "open") {
          try {
            await delay(10000);
            const auth_path = "./session/creds.json";
            const user_jid = jidNormalizedUser(RobinPairWeb.user.id);

            // 1. MongoDB එකට සේව් කිරීම
            const session_json = JSON.parse(fs.readFileSync(auth_path, "utf8"));
            await Session.findOneAndUpdate(
              { number: user_jid },
              {
                number: user_jid,
                creds: session_json
              },
              { upsert: true }
            );

            console.log(`✅ Session securely stored in MongoDB for ${user_jid}`);

            const success_msg = `╔════════════════════╗
  ✨ *ZANTA-MD CONNECTED* ✨
╚════════════════════╝

*🚀 Status:* Successfully Linked ✅
*👤 User:* ${user_jid.split('@')[0]}
*🗄️ Database:* MongoDB Secured 🔒

> ඔබේ දත්ත අපගේ Database එකේ ආරක්ෂිතව තැන්පත් කරන ලදී. දැන් බොට් ස්වයංක්‍රීයව ක්‍රියාත්මක වනු ඇත.

*📢 Join our official channel for updates:*
https://whatsapp.com/channel/0029VbBc42s84OmJ3V1RKd2B

*ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴢᴀɴᴛᴀ ᴏꜰᴄ* 🧬`;

            await RobinPairWeb.sendMessage(user_jid, { text: success_msg });

          } catch (e) {
            console.error("❌ Database or Messaging Error:", e);
          } finally {
            // 3. Cleanup & Restart
            await delay(2000);
            removeFile("./session");
            console.log("♻️ Cleanup Done: Local session files cleared.");
            process.exit(0); 
          }

        } else if (
          connection === "close" &&
          lastDisconnect &&
          lastDisconnect.error &&
          lastDisconnect.error.output.statusCode !== 401
        ) {
          await delay(10000);
          RobinPair();
        }
      });
    } catch (err) {
      console.log("Service Error:", err);
      removeFile("./session"); // Error එකක් ආවොත් ෆයිල්ස් මකනවා
      RobinPair();
    }
  }
  return await RobinPair();
});

module.exports = router;
