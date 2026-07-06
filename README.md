# Synapse • AI Meeting Action Agent & Recap Pipeline

Synapse is an end-to-end automated platform that captures live meeting captions via a browser extension, polishes and summarizes transcripts using Gemini API, matches tasks to team email addresses, and delivers personalized email recaps after a secure safety-review dashboard check.

---

## 🚀 Key Features

*   **🎙️ Live Browser Capture**: Manifest V3 extension captures real-time meeting captions (e.g. Google Meet, Zoom, Teams), grouping speaker inputs cleanly.
*   **✨ Intelligent Glossary Cleanup**: Backend pipeline feeds transcripts + team directory to `gemini-2.5-flash` to resolve misheard names, stutters, and technical terms.
*   **📝 LLM Summarization & Decisions**: Automatically extracts meeting overviews, key decisions, and structured action items (assignee, description, and friendly deadlines).
*   **👥 Contact Directory Matching**: Resolves participant names and speaker tags (including host attribution) to real email addresses via a local JSON directory registry.
*   **✉️ Personalized Outbox Dispatch**: Personalizes HTML recap drafts for each recipient (shows general summary, decisions, plus a highlighted **"★ Your Action Items"** block) sent via Nodemailer (SMTP) or the Resend API.
*   **🛡️ Safety Review Dashboard**: Side-by-side comparative split (Raw vs. Clean), pending list notification badges, inline contact email updates, and single-click manual verification and Retry/Resend buttons.
*   **✅ Todoist Task Integration**: Direct integration to automatically build project cards, configure deadlines, and insert items into your task manager.

---

## 🛠️ Tech Stack

*   **Frontend**: HTML5, Vanilla CSS (Modern dark-slate/violet glassmorphism layout), Vanilla JS (ES6+), and Anime.js (micro-animations).
*   **Backend Server**: Node.js & Express API server.
*   **AI Models**: Google Gemini 2.5 Flash.
*   **Database**: Flat JSON storage (`data/contacts.json`, `data/meetings.json`, `data/config.json`).
*   **Mailers**: Nodemailer (SMTP) & Resend API.
*   **Client**: Chrome/Edge Manifest V3 extension.

---

## 📦 Getting Started

### 1. Run the Backend Server
Initialize dependencies and start the local Node server:
```bash
npm install
npm start
```
The server will boot on `http://localhost:3000`.

### 2. Install the Browser Extension
1. Open Chrome/Edge and go to Extensions (`chrome://extensions` or `edge://extensions`).
2. Toggle on **"Developer mode"** in the top right.
3. Click **"Load unpacked"** and select the `/extension` directory from this project folder.
4. Launch a Google Meet call—the extension will automatically start recording and captioning speaker inputs.

### 3. Open the Dashboard & Configure
1. Navigate to `http://localhost:3000` in your browser.
2. In the sidebar on the left, save your **Gemini API Key**, and configure your preferred email provider (SMTP or Resend).
3. Set your team's display names and email addresses in the **Team Directory** text area (e.g., `Kaustubh dixit: kaustubhmanidixit9@gmail.com`).
4. Click **"Save Configuration"**.

### 4. Review & Dispatch Recaps
*   When a meeting ends, the extension automatically sends the raw transcript to the backend pipeline.
*   The dashboard will instantly notify you, toggle to the **"Meeting Logs"** tab, and highlight the new meeting details.
*   Verify the cleaned transcript, decisions, and outbox delivery addresses.
*   Click **"Approve & Send Recaps"** to dispatch the personalized summaries!

---

## 📂 File Structure

*   `/extension` - Chrome/Edge caption-capture client.
*   `server.js` - Express API backend, database handlers, and mail servers.
*   `app.js` - Client-side state transitions, UI controllers, and animations.
*   `index.html` - Slate glassmorphic single-page dashboard.
*   `style.css` - Custom styling tokens, themes, and animations.
*   `/data` - contacts, config, and meeting historical data store files.
