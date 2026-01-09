const express = require("express");
const fs = require("fs");
const mongoose = require("mongoose");
const qrcode = require("qrcode"); // QR Code එක image එකක් කරන්න ඕන වෙනවා
let router = express.Router();
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  delay,
  makeCacheableSignalKeyStore,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");

// MongoDB Session Schema (ඔයාගේ කලින් එකමයි)
const SessionSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  creds: { type: Object, required: true },
  added_at: { type: Date, default: Date.now }
});
const Session = mongoose.models.Session || mongoose.model("Session", SessionSchema);

// Session folder පිරිසිදු කරන එක
function clearSessionFolder() {
  const folderPath = "./session_qr"; // QR සඳහා වෙනම ෆෝල්ඩර් එකක් පාවිච්චි කිරීම ආරක්ෂිතයි
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      try {
        fs.rmSync(`${folderPath}/${file}`, { recursive: true, force: true });
      } catch (e) {
        console.log("Cleanup error:", e.message);
      }
    });
  } else {
    fs.mkdirSync(folderPath);
  }
}

router.get("/", async (req, res) => {
  async function GetQR() {
    clearSessionFolder();
    const { state, saveCreds } = await useMultiFileAuthState(`./session_qr`);

    try {
      let RobinQRWeb = makeWASocket({
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
        },
        printQRInTerminal: false, // ටර්මිනල් එකේ ප්‍රින්ට් කරන්නේ නැහැ
        logger: pino({ level: "fatal" }),
        browser: ["Zanta-MD", "Chrome", "1.0.0"],
      });

      // ✅ QR එක ලැබුණු විට එය frontend එකට යැවීම
      RobinQRWeb.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect, qr } = s;

        if (qr) {
          // QR එක image එකක් (Data URL) බවට පත් කරලා response එක යවනවා
          const qrImage = await qrcode.toDataURL(qr);
          if (!res.headersSent) {
            return res.send({ qr: qrImage });
          }
        }

        if (connection === "open") {
          try {
            await delay(5000);
            const user_jid = jidNormalizedUser(RobinQRWeb.user.id);
            const auth_path = "./session_qr/creds.json";
            const session_json = JSON.parse(fs.readFileSync(auth_path, "utf8"));

            // MongoDB එකට සේව් කිරීම
            await Session.findOneAndUpdate(
              { number: user_jid },
              { number: user_jid, creds: session_json },
              { upsert: true }
            );

            console.log(`✅ QR Session stored for ${user_jid}`);

            const success_msg = `╔════════════════════╗\n ✨ *ZANTA-MD CONNECTED* ✨\n╚════════════════════╝\n\n*🚀 Status:* Successfully Linked (QR) ✅\n*👤 User:* ${user_jid.split('@')[0]}\n\n> QR එක මගින් සාර්ථකව සම්බන්ධ විය.`;
            await RobinQRWeb.sendMessage(user_jid, { text: success_msg });

          } catch (e) {
            console.error("❌ QR DB Error:", e);
          } finally {
            await delay(2000);
            clearSessionFolder();
            process.exit(0);
          }
        }

        if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
            // connection error එකකදී නැවත උත්සාහ කරන්න අවශ්‍ය නම් මෙතන logic එක දාන්න පුළුවන්
        }
      });

      RobinQRWeb.ev.on("creds.update", saveCreds);

    } catch (err) {
      console.log("QR Service Error:", err);
      res.status(500).send({ error: "Service Error" });
    }
  }
  return await GetQR();
});

module.exports = router;
