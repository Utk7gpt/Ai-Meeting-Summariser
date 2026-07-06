const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON middleware
app.use(express.json());

// Serve static frontend files from current directory
app.use(express.static(__dirname));

// API Endpoint to send email using Resend or SMTP
app.post('/api/send-email', async (req, res) => {
    const { emailProvider, to, subject, html } = req.body;

    if (!to || !to.length) {
        return res.status(400).json({ error: 'Recipient email is required' });
    }

    if (emailProvider === 'smtp') {
        const { smtpHost, smtpPort, smtpUser, smtpPass } = req.body;

        if (!smtpHost || !smtpUser || !smtpPass) {
            return res.status(400).json({ error: 'SMTP Host, User, and Password are required' });
        }

        try {
            console.log(`Sending email from ${smtpUser} to ${to.join(', ')} via SMTP (${smtpHost})...`);

            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: parseInt(smtpPort) || 465,
                secure: parseInt(smtpPort) === 465, // true for port 465, false for 587 or other ports
                auth: {
                    user: smtpUser,
                    pass: smtpPass
                }
            });

            const info = await transporter.sendMail({
                from: smtpUser,
                to: to.join(', '),
                subject: subject || 'Meeting Action Recap & Summary',
                html: html
            });

            console.log('Email sent successfully via SMTP:', info.messageId);
            return res.json({ success: true, messageId: info.messageId });
        } catch (smtpErr) {
            console.error('SMTP sending error:', smtpErr);
            return res.status(500).json({ error: smtpErr.message || 'SMTP delivery failed' });
        }
    } else {
        // Default to Resend API
        const { apiKey, from } = req.body;

        if (!apiKey) {
            return res.status(400).json({ error: 'Resend API Key is required' });
        }

        try {
            console.log(`Sending email from ${from} to ${to.join(', ')} via Resend...`);

            const response = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    from: from || 'onboarding@resend.dev',
                    to: to,
                    subject: subject || 'Meeting Action Items Summary',
                    html: html
                })
            });

            const data = await response.json();

            if (response.ok) {
                console.log('Email sent successfully via Resend:', data);
                return res.json({ success: true, data });
            } else {
                console.error('Resend API error:', data);
                return res.status(response.status).json({ 
                    error: data.message || `Resend API failed with status ${response.status}` 
                });
            }
        } catch (err) {
            console.error('Server-side error sending email via Resend:', err);
            return res.status(500).json({ error: err.message || 'Internal server error occurred via Resend' });
        }
    }
});

// In-memory cache for transcripts and configuration settings
let cachedTranscript = null;
let serverConfig = {
    geminiKey: process.env.GEMINI_API_KEY || "",
    todoistToken: process.env.TODOIST_TOKEN || "",
    emailProvider: process.env.EMAIL_PROVIDER || "resend",
    resendKey: process.env.RESEND_API_KEY || "",
    emailFrom: process.env.EMAIL_FROM || "",
    emailSenderName: process.env.EMAIL_SENDER_NAME || "You",
    emailRecipients: process.env.EMAIL_RECIPIENTS || "",
    teamDirectory: process.env.TEAM_DIRECTORY || "",
    smtpSettings: {
        smtpHost: process.env.SMTP_HOST || "",
        smtpPort: process.env.SMTP_PORT || "",
        smtpUser: process.env.SMTP_USER || "",
        smtpPass: process.env.SMTP_PASS || ""
    }
};

// Endpoint to fetch current non-sensitive server config (checking for shared deployment credentials)
app.get('/api/config', (req, res) => {
    const hasSharedConfig = !!serverConfig.geminiKey;
    return res.json({
        hasSharedConfig,
        emailProvider: serverConfig.emailProvider,
        emailFrom: serverConfig.emailFrom,
        emailSenderName: serverConfig.emailSenderName,
        emailRecipients: serverConfig.emailRecipients,
        teamDirectory: serverConfig.teamDirectory
    });
});

// Endpoint to sync dashboard credentials with the backend
app.post('/api/config', (req, res) => {
    const { config } = req.body;
    if (config) {
        // If the client is syncing keys, we merge them with server memory
        serverConfig = {
            ...serverConfig,
            ...config,
            smtpSettings: {
                ...serverConfig.smtpSettings,
                ...(config.smtpSettings || {})
            }
        };
        console.log("[Synapse Server] Synced API credentials and email server settings with backend.");
    }
    return res.json({ success: true });
});

// Endpoint for the extension to send transcripts (triggers automated pipeline instantly)
app.post('/api/transcript', async (req, res) => {
    const { transcript } = req.body;
    if (!transcript || !Array.isArray(transcript)) {
        return res.status(400).json({ error: 'Structured transcript array is required' });
    }

    console.log(`[Synapse Server] Received captions from extension. Running automated pipeline...`);

    try {
        // 1. Group consecutive raw transcript lines by speaker
        const groupedRaw = [];
        transcript.forEach(line => {
            const text = line.text.trim();
            if (!text) return;

            if (groupedRaw.length > 0) {
                const last = groupedRaw[groupedRaw.length - 1];
                if (last.speaker === line.speaker) {
                    const lastText = last.text.trim();
                    if (lastText.includes(text)) return;
                    if (text.startsWith(lastText)) {
                        last.text = text;
                        return;
                    }
                    const separator = (last.text.endsWith('.') || last.text.endsWith('?') || last.text.endsWith('!')) ? ' ' : '. ';
                    last.text += separator + text;
                    return;
                }
            }

            groupedRaw.push({
                speaker: line.speaker,
                text: text,
                timestamp: line.timestamp
            });
        });

        // 2. Perform automated cleanup and summarization
        let cleanTranscriptText = "";
        let cleanTranscriptRaw = [];
        let summary = "";
        let decisions = [];
        let tasks = [];

        const contacts = readJSON(CONTACTS_FILE);
        const mode = serverConfig.geminiKey ? 'live' : 'demo';

        if (mode === 'demo') {
            cleanTranscriptRaw = groupedRaw.map(line => ({
                speaker: line.speaker,
                text: line.text.replace(/recordin/g, 'recording').replace(/cations/g, 'captions'),
                timestamp: line.timestamp
            }));
            cleanTranscriptText = cleanTranscriptRaw.map(line => `[${line.timestamp}] ${line.speaker}: ${line.text}`).join('\n');
            summary = "The team aligned on the timeline for deploying Q3 software changes. Kaustubh agreed to complete pricing pages on staging by Thursday. Ekam agreed to test the checkout flow early next week.";
            decisions = [
                "Decided to release staging code by Thursday night.",
                "Approved Ekam's test case design timeline."
            ];
            tasks = [
                { task: "Finalize pricing page", owner: "Kaustubh", due_date: "Thursday" },
                { task: "Test checkout flow", owner: "Ekam", due_date: "Early next week" },
                { task: "Follow up with vendor about contract", owner: "You", due_date: "Friday" }
            ];
        } else {
            // Live cleanup via Gemini on server
            const rawProse = groupedRaw.map(line => `[${line.timestamp}] ${line.speaker}: ${line.text}`).join('\n');
            const cleanupPrompt = `You are a professional transcript cleanup assistant. Clean the following raw meeting transcript.
Glossary / Participants list:
${contacts.map(c => `- ${c.name} (Aliases: ${c.aliases.join(', ')}) -> ${c.email}`).join('\n')}

Instructions:
- Fix STT spelling errors, stutters, and filler words ("um", "like").
- Correct misheard names using the glossary names.
- Output clean speaker paragraphs with timestamps.

Raw Transcript:
${rawProse}`;

            cleanTranscriptText = await callGeminiOnServer(serverConfig.geminiKey, cleanupPrompt);
            cleanTranscriptRaw = cleanTranscriptText.split('\n').map(line => {
                const match = line.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*([^:]+):\s*(.*)/);
                if (match) return { timestamp: match[1], speaker: match[2].trim(), text: match[3].trim() };
                return { timestamp: new Date().toTimeString().split(' ')[0], speaker: "Speaker", text: line };
            });

            // Live summarization via Gemini on server
            const summarizationPrompt = `You are a meeting summarization agent. Analyze the following cleaned transcript and return a strict JSON object containing:
- "summary": a 2-paragraph high-level overview.
- "decisions": a string array of key decisions.
- "tasks": a list of extracted action items. Each action item must have:
  - "task": the description of the task.
  - "owner": the name of the assignee.
  - "due_date": friendly due date.

Return ONLY the raw JSON object. Do not wrap in markdown code blocks.

Transcript:
${cleanTranscriptText}`;

            const sumResultText = await callGeminiOnServer(serverConfig.geminiKey, summarizationPrompt);
            let cleanedJSONText = sumResultText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanedJSONText);
            
            summary = parsed.summary || "No summary generated.";
            decisions = parsed.decisions || [];
            tasks = parsed.tasks || [];
        }

        const matchedTasks = matchParticipants(tasks, contacts, groupedRaw);
        const meetingId = 'meet_' + Date.now();
        const meetingRecord = {
            id: meetingId,
            timestamp: new Date().toLocaleString(),
            title: `Meeting Recap - ${new Date().toLocaleDateString()}`,
            rawTranscript: groupedRaw,
            cleanTranscript: cleanTranscriptText,
            cleanTranscriptRaw: cleanTranscriptRaw,
            summary: summary,
            decisions: decisions,
            tasks: matchedTasks,
            status: "pending_review",
            emailLogs: []
        };

        // Write meeting log to database file
        const meetings = readJSON(MEETINGS_FILE);
        meetings.unshift(meetingRecord);
        writeJSON(MEETINGS_FILE, meetings);

        // Cache prose representation for active dashboard notifications
        cachedTranscript = {
            prose: cleanTranscriptText,
            raw: groupedRaw,
            timestamp: new Date().toISOString(),
            meetingId: meetingId // Include meeting ID so dashboard can auto-focus it!
        };

        console.log(`[Synapse Server] Automatically processed and logged transcript: ${meetingId}. Cleaned down to ${groupedRaw.length} paragraphs.`);
        return res.json({ success: true, meetingId });

    } catch (err) {
        console.error('[Synapse Server] Automatic pipeline error:', err);
        return res.status(500).json({ error: err.message || 'Pipeline failed' });
    }
});

// Endpoint for the web app dashboard to consume the latest transcript
app.get('/api/latest-transcript', (req, res) => {
    if (!cachedTranscript) {
        return res.json({ transcript: null });
    }
    
    // Send and clear cache
    const temp = cachedTranscript;
    cachedTranscript = null;
    return res.json({ transcript: temp });
});

// ==========================================
// Synapse Audit DB & Auto-Mailer Endpoints
// ==========================================

const fs = require('fs');
const os = require('os');

// Detect if running on Vercel serverless environment (where the root directory is read-only)
const isVercel = process.env.VERCEL || process.env.NOW_BUILDER;
const DATA_DIR = isVercel ? path.join(os.tmpdir(), 'data') : path.join(__dirname, 'data');

const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const MEETINGS_FILE = path.join(DATA_DIR, 'meetings.json');

// Ensure database folders and files exist
function initDatabase() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(CONTACTS_FILE)) {
        fs.writeFileSync(CONTACTS_FILE, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(MEETINGS_FILE)) {
        fs.writeFileSync(MEETINGS_FILE, JSON.stringify([], null, 2));
    }
}
initDatabase();

// JSON Database File Access Helpers
function readJSON(file) {
    try {
        if (!fs.existsSync(file)) return [];
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        console.error(`Error reading database file ${file}:`, e);
        return [];
    }
}

function writeJSON(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error(`Error writing database file ${file}:`, e);
    }
}

// Reusable server-side Gemini prompt driver
async function callGeminiOnServer(key, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });
    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Gemini API returned status ${response.status}`);
    }
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Match extracted task owners against the contacts directory and include all meeting speakers
function matchParticipants(tasks, contacts, rawTranscript = []) {
    const matched = tasks.map(task => {
        const ownerLower = task.owner.toLowerCase();
        let matchedContact = contacts.find(c => 
            c.name.toLowerCase() === ownerLower || 
            c.aliases.some(alias => alias.toLowerCase() === ownerLower)
        );

        return {
            task: task.task,
            owner: task.owner,
            due_date: task.due_date,
            email: matchedContact ? matchedContact.email : null,
            emailStatus: matchedContact ? "pending" : "missing_email"
        };
    });

    // Add speakers who don't have tasks assigned so they are in the delivery outbox
    const speakers = new Set(rawTranscript.map(line => line.speaker).filter(s => s && s.toLowerCase() !== 'system' && s.toLowerCase() !== 'you'));
    speakers.forEach(speaker => {
        const speakerLower = speaker.toLowerCase();
        const exists = matched.some(m => m.owner.toLowerCase() === speakerLower);
        if (!exists) {
            let matchedContact = contacts.find(c => 
                c.name.toLowerCase() === speakerLower || 
                c.aliases.some(alias => alias.toLowerCase() === speakerLower)
            );
            matched.push({
                task: "(No direct action items assigned)",
                owner: speaker,
                due_date: "-",
                email: matchedContact ? matchedContact.email : null,
                emailStatus: matchedContact ? "pending" : "missing_email"
            });
        }
    });

    return matched;
}

// Modular SMTP sender wrapper
async function sendEmailSMTP({ host, port, user, pass, to, subject, html }) {
    if (!host || !user || !pass) {
        return { success: false, error: 'SMTP configurations are missing.' };
    }
    try {
        const transporter = nodemailer.createTransport({
            host: host,
            port: parseInt(port) || 465,
            secure: parseInt(port) === 465,
            auth: { user, pass }
        });
        const info = await transporter.sendMail({
            from: user,
            to: to,
            subject: subject,
            html: html
        });
        return { success: true, messageId: info.messageId };
    } catch (err) {
        console.error(`SMTP Mail Dispatch Fail to ${to}:`, err);
        return { success: false, error: err.message || 'SMTP dispatch failed' };
    }
}

// Modular Resend API sender wrapper
async function sendEmailResend({ key, from, to, subject, html }) {
    if (!key) {
        return { success: false, error: 'Resend API Key is missing.' };
    }
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                from: from,
                to: [to],
                subject: subject,
                html: html
            })
        });
        const data = await response.json();
        if (response.ok) {
            return { success: true, data };
        } else {
            return { success: false, error: data.message || `Resend failed with status ${response.status}` };
        }
    } catch (err) {
        console.error(`Resend Mail Dispatch Fail to ${to}:`, err);
        return { success: false, error: err.message || 'Resend API dispatch failed' };
    }
}

// Endpoint: Fetch contacts directory list
app.get('/api/contacts', (req, res) => {
    const contacts = readJSON(CONTACTS_FILE);
    return res.json({ contacts });
});

// Endpoint: Sync/Save contacts array
app.post('/api/contacts/sync', (req, res) => {
    const { contacts } = req.body;
    if (!contacts || !Array.isArray(contacts)) {
        return res.status(400).json({ error: 'Contacts list is required.' });
    }
    writeJSON(CONTACTS_FILE, contacts);
    console.log(`[Synapse Server] Synced contact registry directory: ${contacts.length} entries.`);
    return res.json({ success: true });
});

// Endpoint: Fetch list of meetings logged
app.get('/api/meetings', (req, res) => {
    const meetings = readJSON(MEETINGS_FILE);
    return res.json({ meetings });
});

// Endpoint: Process raw transcript, clean, summarize, and log record (Pending Approval)
app.post('/api/meetings/create', async (req, res) => {
    const { rawTranscript, mode, geminiKey } = req.body;
    if (!rawTranscript || !Array.isArray(rawTranscript)) {
        return res.status(400).json({ error: 'rawTranscript is required' });
    }

    try {
        let cleanTranscriptText = "";
        let cleanTranscriptRaw = [];
        let summary = "";
        let decisions = [];
        let tasks = [];

        const contacts = readJSON(CONTACTS_FILE);

        if (mode === 'demo' || !geminiKey) {
            // Simulated delay for testing in Demo mode
            await new Promise(resolve => setTimeout(resolve, 1200));
            
            cleanTranscriptRaw = rawTranscript.map(line => ({
                speaker: line.speaker,
                text: line.text.replace(/recordin/g, 'recording').replace(/cations/g, 'captions'),
                timestamp: line.timestamp
            }));

            cleanTranscriptText = cleanTranscriptRaw.map(line => `[${line.timestamp}] ${line.speaker}: ${line.text}`).join('\n');
            summary = "The team discussed the upcoming Q3 software deployment parameters. Kaustubh agreed to host the updated code on the staging branch by Thursday, while Ekam was approved to build test cases for the billing engine early next week.";
            decisions = [
                "Agreed to finalize pricing layouts on staging by Thursday.",
                "Approved Ekam to deploy automations for billing early next week."
            ];
            tasks = [
                { task: "Finalize pricing page", owner: "Kaustubh", due_date: "Thursday" },
                { task: "Test checkout flow", owner: "Ekam", due_date: "Early next week" },
                { task: "Follow up with vendor about contract", owner: "You", due_date: "Friday" }
            ];
        } else {
            // 1. Run caption cleanup using Gemini LLM and local glossary (contacts list)
            const rawProse = rawTranscript.map(line => `[${line.timestamp}] ${line.speaker}: ${line.text}`).join('\n');
            const cleanupPrompt = `You are a professional transcript cleanup assistant. Clean and polish the following raw meeting transcript.
Glossary / Participants list:
${contacts.map(c => `- ${c.name} (Aliases: ${c.aliases.join(', ')}) -> ${c.email}`).join('\n')}

Instructions:
- Fix obvious speech-to-text spelling anomalies, stutters, and filler words ("um", "like", "uh").
- Correct misheard names using the glossary names.
- Output clean, readable paragraphs, keeping speaker attribution and timestamps.
- Do not summarize or remove actual meeting context.

Raw Transcript:
${rawProse}`;

            const cleanupResultText = await callGeminiOnServer(geminiKey, cleanupPrompt);
            cleanTranscriptText = cleanupResultText.trim();
            
            // Re-map cleaned text strings to basic line entries
            cleanTranscriptRaw = cleanTranscriptText.split('\n').map(line => {
                const match = line.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*([^:]+):\s*(.*)/);
                if (match) {
                    return { timestamp: match[1], speaker: match[2].trim(), text: match[3].trim() };
                }
                return { timestamp: new Date().toTimeString().split(' ')[0], speaker: "Speaker", text: line };
            });

            // 2. Generate summary, key decisions, and tasks
            const summarizationPrompt = `You are a meeting summarization agent. Analyze the following cleaned transcript and return a strict JSON object containing:
- "summary": a 2-paragraph high-level overview.
- "decisions": a string array of key decisions.
- "tasks": a list of extracted action items. Each action item must have:
  - "task": the description of the task.
  - "owner": the name of the assignee.
  - "due_date": friendly due date.

Return ONLY the raw JSON object. Do not wrap it in markdown code blocks.

Transcript:
${cleanTranscriptText}`;

            const sumResultText = await callGeminiOnServer(geminiKey, summarizationPrompt);
            let cleanedJSONText = sumResultText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanedJSONText);
            
            summary = parsed.summary || "No summary generated.";
            decisions = parsed.decisions || [];
            tasks = parsed.tasks || [];
        }

        // 3. Match assignee names to email addresses
        const matchedTasks = matchParticipants(tasks, contacts, rawTranscript);

        // Build meeting log structure
        const meetingId = 'meet_' + Date.now();
        const meetingRecord = {
            id: meetingId,
            timestamp: new Date().toLocaleString(),
            title: `Meeting Recap - ${new Date().toLocaleDateString()}`,
            rawTranscript: rawTranscript,
            cleanTranscript: cleanTranscriptText,
            cleanTranscriptRaw: cleanTranscriptRaw,
            summary: summary,
            decisions: decisions,
            tasks: matchedTasks,
            status: "pending_review",
            emailLogs: []
        };

        // Prepend new record to DB file
        const meetings = readJSON(MEETINGS_FILE);
        meetings.unshift(meetingRecord);
        writeJSON(MEETINGS_FILE, meetings);

        console.log(`[Synapse Server] Created new meeting audit record: ${meetingId}. Status: pending_review.`);
        return res.json({ success: true, meeting: meetingRecord });

    } catch (err) {
        console.error('Server error creating meeting logs:', err);
        return res.status(500).json({ error: err.message || 'Failed to process and log transcript.' });
    }
});

// Endpoint: Approve and send recap emails (Safety Review Step)
app.post('/api/meetings/:id/approve', async (req, res) => {
    const { id } = req.params;
    const { smtpSettings, emailProvider, resendKey, emailFrom, emailSenderName, globalRecipients } = req.body;

    const meetings = readJSON(MEETINGS_FILE);
    const meetingIndex = meetings.findIndex(m => m.id === id);

    if (meetingIndex === -1) {
        return res.status(404).json({ error: 'Meeting not found.' });
    }

    const meeting = meetings[meetingIndex];

    try {
        meeting.status = "sending";
        writeJSON(MEETINGS_FILE, meetings);

        const emailLogs = [];
        let allSucceeded = true;

        // Group unique emails of task assignees who spoke
        const assigneeEmails = new Set(meeting.tasks.map(t => t.email).filter(e => e && e.includes('@')));
        
        // Add sender email so host always receives a copy of the audit recap
        const userEmail = smtpSettings?.smtpUser || emailFrom;
        if (userEmail && userEmail.includes('@')) {
            assigneeEmails.add(userEmail);
        }

        // Add global recipients specified in dashboard settings sidebar
        if (globalRecipients && typeof globalRecipients === 'string') {
            globalRecipients.split(',').forEach(email => {
                const trimmed = email.trim();
                if (trimmed && trimmed.includes('@')) {
                    assigneeEmails.add(trimmed);
                }
            });
        }

        const recipientList = Array.from(assigneeEmails);

        if (recipientList.length === 0) {
            meeting.status = "no_recipients";
            writeJSON(MEETINGS_FILE, meetings);
            return res.json({ success: true, meeting, message: "No participant emails found to send." });
        }

        // Send customized email to each participant
        for (const recipient of recipientList) {
            // Filter tasks assigned to this recipient
            const userTasks = meeting.tasks.filter(t => t.email === recipient);
            const actualUserTasks = userTasks.filter(t => t.task !== "(No direct action items assigned)");
            const userTasksHtml = actualUserTasks.length > 0
                ? actualUserTasks.map(t => `<li><strong>[Action Item]</strong> ${t.task} - <em>Due: ${t.due_date}</em></li>`).join('')
                : '<li>No direct action items assigned.</li>';

            const allTasksHtml = meeting.tasks.map(t => `
                <li><strong>${t.owner}</strong>: ${t.task} ${t.email ? `(${t.email})` : ''} - <em>Due: ${t.due_date}</em></li>
            `).join('');

            const decisionsHtml = meeting.decisions.map(d => `<li>${d}</li>`).join('');

            const htmlContent = `
                <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #edf2f7; padding: 24px; border-radius: 8px;">
                    <h2 style="color: #6366f1; border-bottom: 2px solid #f3f4f6; padding-bottom: 8px;">${meeting.title}</h2>
                    
                    <p style="font-size: 1.05rem; color: #4a5568;">Hi there,</p>
                    <p>Here is the automated summary and action recap from our recent meeting.</p>
                    
                    <div style="background-color: #f7fafc; border-left: 4px solid #6366f1; padding: 16px; margin: 20px 0; border-radius: 4px;">
                        <h3 style="margin-top: 0; color: #2d3748;">Meeting Summary</h3>
                        <p style="margin-bottom: 0; color: #4a5568;">${meeting.summary}</p>
                    </div>

                    <h3 style="color: #4a5568; margin-top: 24px;">Key Decisions Made</h3>
                    <ul style="padding-left: 20px; color: #4a5568;">
                        ${decisionsHtml || '<li>No explicit decisions logged.</li>'}
                    </ul>
                    
                    <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; border-radius: 4px;">
                        <h3 style="margin-top: 0; color: #14532d;">★ Your Action Items</h3>
                        <ul style="padding-left: 20px; color: #14532d; margin-bottom: 0;">
                            ${userTasksHtml}
                        </ul>
                    </div>

                    <h3 style="color: #4a5568; margin-top: 24px;">All Team Tasks</h3>
                    <ul style="padding-left: 20px; color: #4a5568;">
                        ${allTasksHtml || '<li>No action items extracted.</li>'}
                    </ul>

                    <p style="margin-top: 32px; font-size: 0.85rem; color: #718096; border-top: 1px solid #f3f4f6; padding-top: 16px; text-align: center;">
                        Sent automatically by Synapse Meeting Copilot.
                    </p>
                </div>
            `;

            let sendResult;
            if (emailProvider === 'smtp') {
                sendResult = await sendEmailSMTP({
                    host: smtpSettings.smtpHost,
                    port: smtpSettings.smtpPort,
                    user: smtpSettings.smtpUser,
                    pass: smtpSettings.smtpPass,
                    to: recipient,
                    subject: `${meeting.title} - Your Action Recap`,
                    html: htmlContent
                });
            } else {
                sendResult = await sendEmailResend({
                    key: resendKey,
                    from: emailFrom || 'onboarding@resend.dev',
                    to: recipient,
                    subject: `${meeting.title} - Your Action Recap`,
                    html: htmlContent
                });
            }

            emailLogs.push({
                recipient: recipient,
                status: sendResult.success ? "sent" : "failed",
                error: sendResult.error || null,
                timestamp: new Date().toLocaleString()
            });

            if (!sendResult.success) {
                allSucceeded = false;
            }
        }

        // Update individual task email statuses in log
        meeting.tasks.forEach(t => {
            if (t.email) {
                const log = emailLogs.find(l => l.recipient === t.email);
                if (log) t.emailStatus = log.status;
            }
        });

        meeting.status = allSucceeded ? "sent" : "failed_some";
        meeting.emailLogs = emailLogs;
        writeJSON(MEETINGS_FILE, meetings);

        console.log(`[Synapse Server] Completed email dispatches for ${id}. Status: ${meeting.status}.`);
        return res.json({ success: true, meeting });

    } catch (err) {
        console.error('Approval dispatch error:', err);
        meeting.status = "failed";
        writeJSON(MEETINGS_FILE, meetings);
        return res.status(500).json({ error: err.message || 'Failed to dispatch recap emails.' });
    }
});

// Endpoint: Retry failed emails (Logs Retrying Engine)
app.post('/api/meetings/:id/resend', async (req, res) => {
    const { id } = req.params;
    const { email, smtpSettings, emailProvider, resendKey, emailFrom } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Recipient email is required for retry.' });
    }

    const meetings = readJSON(MEETINGS_FILE);
    const meeting = meetings.find(m => m.id === id);

    if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found.' });
    }

    try {
        // Build email body content
        const userTasks = meeting.tasks.filter(t => t.email === email);
        const userTasksHtml = userTasks.length > 0
            ? userTasks.map(t => `<li><strong>[Action Item]</strong> ${t.task} - <em>Due: ${t.due_date}</em></li>`).join('')
            : '<li>No direct action items assigned.</li>';

        const allTasksHtml = meeting.tasks.map(t => `
            <li><strong>${t.owner}</strong>: ${t.task} ${t.email ? `(${t.email})` : ''} - <em>Due: ${t.due_date}</em></li>
        `).join('');

        const decisionsHtml = meeting.decisions.map(d => `<li>${d}</li>`).join('');

        const htmlContent = `
            <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #edf2f7; padding: 24px; border-radius: 8px;">
                <h2 style="color: #6366f1; border-bottom: 2px solid #f3f4f6; padding-bottom: 8px;">[RETRY] ${meeting.title}</h2>
                <p>Here is your retried recap for the meeting.</p>
                <div style="background-color: #f7fafc; border-left: 4px solid #6366f1; padding: 16px; margin: 20px 0; border-radius: 4px;">
                    <h3>Meeting Summary</h3>
                    <p>${meeting.summary}</p>
                </div>
                <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0; border-radius: 4px;">
                    <h3>★ Your Action Items</h3>
                    <ul>${userTasksHtml}</ul>
                </div>
                <h3>All Team Tasks</h3>
                <ul>${allTasksHtml}</ul>
            </div>
        `;

        let sendResult;
        if (emailProvider === 'smtp') {
            sendResult = await sendEmailSMTP({
                host: smtpSettings.smtpHost,
                port: smtpSettings.smtpPort,
                user: smtpSettings.smtpUser,
                pass: smtpSettings.smtpPass,
                to: email,
                subject: `${meeting.title} - Your Action Recap (Retry)`,
                html: htmlContent
            });
        } else {
            sendResult = await sendEmailResend({
                key: resendKey,
                from: emailFrom || 'onboarding@resend.dev',
                to: email,
                subject: `${meeting.title} - Your Action Recap (Retry)`,
                html: htmlContent
            });
        }

        // Update logs in meeting record
        if (!meeting.emailLogs) meeting.emailLogs = [];
        const existingLogIndex = meeting.emailLogs.findIndex(l => l.recipient === email);
        const logData = {
            recipient: email,
            status: sendResult.success ? "sent" : "failed",
            error: sendResult.error || null,
            timestamp: new Date().toLocaleString()
        };

        if (existingLogIndex !== -1) {
            meeting.emailLogs[existingLogIndex] = logData;
        } else {
            meeting.emailLogs.push(logData);
        }

        // Update individual task email statuses
        meeting.tasks.forEach(t => {
            if (t.email === email) {
                t.emailStatus = sendResult.success ? "sent" : "failed";
            }
        });

        // Recheck overall meeting status
        const allSucceeded = meeting.tasks.every(t => !t.email || t.emailStatus === 'sent');
        meeting.status = allSucceeded ? "sent" : "failed_some";

        writeJSON(MEETINGS_FILE, meetings);

        return res.json({ success: sendResult.success, meeting, error: sendResult.error });

    } catch (err) {
        console.error('[Synapse] Individual retry fail:', err);
        return res.status(500).json({ error: err.message });
    }
});

// Fallback for SPA routing to serve index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`   Synapse Meeting Action Agent is running!`);
        console.log(`   Access the dashboard at: http://localhost:${PORT}`);
        console.log(`=======================================================`);
    });
}

module.exports = app;
