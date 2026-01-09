const express = require("express");
const fs = require("fs");
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

// ✅ සෙෂන් ෆෝල්ඩර් එක පිරිසිදු කරන Function එක
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
  }
}

router.get("/", async (req, res) => {
  let num = req.query.number;
  let pairingTimeout; 

  async function RobinPair() {
    clearSessionFolder();

    const { state, saveCreds } = await useMultiFileAuthState(`./session`);
    
    try {
      let RobinPairWeb = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        // ✅ බ්‍රවුසර් එක Safari (macOS) ලෙස වෙනස් කළා
        browser: Browsers.macOS("Safari"), 
      });

      if (!RobinPairWeb.authState.creds.registered) {
        await delay(1500);
        num = num.replace(/[^0-9]/g, "");
        const code = await RobinPairWeb.requestPairingCode(num);
        
        if (!res.headersSent) {
          await res.send({ code });
        }

        // ✅ FAIL-SAFE: යූසර් ලින්ක් නොවුණොත් විනාඩි 2කින් සෙෂන් එක මකන්න
        pairingTimeout = setTimeout(() => {
          console.log("🕒 Timeout: User didn't link. Clearing session.");
          clearSessionFolder();
        }, 120000); 
      }

      RobinPairWeb.ev.on("creds.update", saveCreds);
      RobinPairWeb.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect } = s;
        
        if (connection === "open") {
          if (pairingTimeout) clearTimeout(pairingTimeout);

          try {
            await delay(10000);
            const auth_path = "./session/creds.json";
            const user_jid = jidNormalizedUser(RobinPairWeb.user.id);

            const session_json = JSON.parse(fs.readFileSync(auth_path, "utf8"));
            await Session.findOneAndUpdate(
              { number: user_jid },
              { number: user_jid, creds: session_json },
              { upsert: true }
            );

            const success_msg = `╔════════════════════╗\n ✨ *ZANTA-MD CONNECTED* ✨\n╚════════════════════╝\n\n*🚀 Status:* Successfully Linked ✅\n\n> ඔබේ දත්ත සුරැකින ලදී.`;
            await RobinPairWeb.sendMessage(user_jid, { text: success_msg });

            console.log(`✅ Success for ${user_jid}`);

          } catch (e) {
            console.error("❌ Error:", e);
          } finally {
            // ✅ වැඩේ ඉවර වුණාම සෙෂන් එක මකලා process එක close කරනවා
            await delay(2000);
            clearSessionFolder();
            process.exit(0); 
          }
        } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
          await delay(5000);
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
