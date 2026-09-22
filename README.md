# VocalRemover Automation (Puppeteer + PNPM)

Automated stem separation tool with a modern dark glassmorphic web dashboard and Puppeteer backend. Upload any audio file, track AI stem extraction in real time, and download the isolated **Vocal** (or Music) track.

---

## 🌐 Web Interface (Recommended)

1. **Start the Web Dashboard**:
   ```bash
   pnpm start
   ```
2. **Open in Browser**:
   Navigate to [http://localhost:3000](http://localhost:3000).
3. **Drag & Drop** any audio file, select **Vocals Only** (or Music), and click **Separate Audio Stems**!
4. Track the live 4-step progress and terminal logs, audition the vocal track in the player, and click **Download**.

---

## 💻 Command Line Interface (CLI)

If you prefer running via terminal without the web UI:

```bash
# Run with the default sample file:
pnpm cli

# Or specify a custom audio file and stem:
node index.js "C:\path\to\your\song.mp3" vocal
node index.js "C:\path\to\your\song.mp3" music
```

---

## ⚙️ Configuration (`config.js`)

You can customize runtime settings in [config.js](file:///d:/Dev/webcombo/config.js):

| Setting             | Default         | Description                                        |
| ------------------- | --------------- | -------------------------------------------------- |
| `downloadTrack`     | `'vocal'`       | Choose `'vocal'` (default), `'music'`, or `'both'` |
| `downloadDir`       | `./downloads`   | Directory where downloaded tracks are saved        |
| `headless`          | `true`          | Run in background (`true`) or visible (`false`)    |
| `processingTimeout` | `60000` (1 min) | Maximum wait time for AI stem processing           |

---

## ℹ️ Server Rate Limits

`vocalremover.org` enforces a server-side limit on free IP addresses (typically 1–2 free conversions per IP per day). When reached, the website displays:

> _"Too many requests from your IP address. Please try again later or become a patron"_

The application automatically detects this message immediately without hanging.

### With VPN / Cloudflare One:

Since you are using a **VPN / Cloudflare One**, if you ever hit the daily free limit, simply:

1. Reconnect or switch your **VPN / Cloudflare One** location to obtain a fresh IP.
2. Click **Try Again** in the web dashboard (or re-run `pnpm start`).
