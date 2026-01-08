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

// ✅ ෆයිල්ස් මකන එක ආරක්ෂිතව කරන්න හදපු Function එක
function clearSessionFolder() {
  const folderPath = "./session";
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      try {
        fs.rmSync(`${folderPath}/${file}`, { recursive: true, force: true });
      } catch (e) {
        console.log("Cleanup error:", e.message);
      }
    });
    console.log("🧹 Session folder cleared.");
  } else {
    fs.mkdirSync(folderPath);
    console.log("📁 Session folder created.");
  }
}

router.get("/", async (req, res) => {
  let num = req.query.number;
  
  async function RobinPair() {
    // 1. මුලින්ම පරණ session data විතරක් මකනවා (Folder එක තියෙද්දී)
    clearSessionFolder();

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
        // ✅ වඩාත් ස්ථාවර Ubuntu Chrome බ්‍රවුසරය
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
      });

      if (!RobinPairWeb.authState.creds.registered) {
        await delay(1500);
        num = num.replace(/[^0-9]/g, "");
        const code = await RobinPairWeb.requestPairingCode(num);
        
        if (!res.headersSent) {
          await res.send({ code });
        }

        // ✅ විනාඩි 3 කින් creds.json එක පමණක් මකා දමනවා
        // මෙතනදී මුළු ෆෝල්ඩරයම මකන්නේ නැති නිසා ENOENT error එක එන්නේ නැහැ
        setTimeout(() => {
          try {
            const credsPath = "./session/creds.json";
            if (fs.existsSync(credsPath)) {
              fs.unlinkSync(credsPath);
              console.log("🕒 3 Minutes Timeout: creds.json deleted for security.");
            }
          } catch (e) {
            console.log("Timeout cleanup error:", e.message);
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
            // 3. වැඩේ ඉවර වුණාම ක්ලීන් කරලා ප්‍රොසෙස් එක නවත්වනවා
            await delay(2000);
            clearSessionFolder();
            console.log("♻️ Cleanup Done.");
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
      clearSessionFolder(); 
      RobinPair();
    }
  }
  return await RobinPair();
});

module.exports = router;
