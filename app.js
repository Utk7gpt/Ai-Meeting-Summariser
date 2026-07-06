// App Configuration & State Management
let appState = {
    mode: 'demo', // 'demo' or 'live'
    geminiKey: '',
    todoistToken: '',
    emailProvider: 'resend', // 'resend' or 'smtp'
    resendKey: '',
    emailFrom: '',
    smtpHost: '',
    smtpPort: '',
    smtpUser: '',
    smtpPass: '',
    emailRecipients: '',
    emailSenderName: 'You',
    extractedTasks: [],
    originalNotes: ''
};

// DOM Elements
const elements = {
    btnDemoMode: document.getElementById('btn-demo-mode'),
    btnLiveMode: document.getElementById('btn-live-mode'),
    credentialsSection: document.getElementById('credentials-section'),
    geminiKeyInput: document.getElementById('gemini-key'),
    todoistTokenInput: document.getElementById('todoist-token'),
    
    // Email Provider inputs
    emailProviderInput: document.getElementById('email-provider'),
    emailResendSection: document.getElementById('email-resend-section'),
    emailSmtpSection: document.getElementById('email-smtp-section'),
    resendKeyInput: document.getElementById('resend-key'),
    emailFromInput: document.getElementById('email-from'),
    smtpHostInput: document.getElementById('smtp-host'),
    smtpPortInput: document.getElementById('smtp-port'),
    smtpUserInput: document.getElementById('smtp-user'),
    smtpPassInput: document.getElementById('smtp-pass'),
    
    emailRecipientsInput: document.getElementById('email-recipients'),
    teamDirectoryInput: document.getElementById('team-directory'),
    emailSenderNameInput: document.getElementById('email-sender-name'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    modeBadge: document.getElementById('mode-badge'),
    modeDescText: document.getElementById('mode-desc-text'),

    // Authentication elements
    authContainer: document.getElementById('auth-container'),
    formSignin: document.getElementById('form-signin'),
    formSignup: document.getElementById('form-signup'),
    linkShowSignup: document.getElementById('link-show-signup'),
    linkShowSignin: document.getElementById('link-show-signin'),
    btnQuickLogin: document.getElementById('btn-quick-login'),
    btnSignOut: document.getElementById('btn-sign-out'),
    signinEmail: document.getElementById('signin-email'),
    signinPassword: document.getElementById('signin-password'),
    signupName: document.getElementById('signup-name'),
    signupEmail: document.getElementById('signup-email'),
    signupPassword: document.getElementById('signup-password'),

    // Workspace & Navigation elements
    tabWorkspace: document.getElementById('tab-workspace'),
    tabLogs: document.getElementById('tab-logs'),
    workspaceView: document.getElementById('workspace-view'),
    logsView: document.getElementById('logs-view'),
    meetingsList: document.getElementById('meetings-list'),
    logsPendingBadge: document.getElementById('logs-pending-badge'),
    selectedMeetingEmpty: document.getElementById('selected-meeting-empty'),
    selectedMeetingContent: document.getElementById('selected-meeting-content'),

    // Step panels
    stepInput: document.getElementById('step-input'),
    stepReview: document.getElementById('step-review'),
    stepConfirm: document.getElementById('step-confirm'),

    // Input elements
    notesInput: document.getElementById('notes-input'),
    btnInsertDemo: document.getElementById('btn-insert-demo'),
    btnParseNotes: document.getElementById('btn-parse-notes'),

    // Review elements
    reviewTableBody: document.getElementById('review-table-body'),
    btnAddTaskRow: document.getElementById('btn-add-task-row'),
    btnBackToInput: document.getElementById('btn-back-to-input'),
    btnExecuteAutomations: document.getElementById('btn-execute-automations'),

    // Confirm elements
    confirmBeforeText: document.getElementById('confirm-before-text'),
    todoistLinksContainer: document.getElementById('todoist-links-container'),
    todoistOutcomeCard: document.getElementById('todoist-outcome-card'),
    todoistOutcomeDesc: document.getElementById('todoist-outcome-desc'),
    btnOpenEmailPreview: document.getElementById('btn-open-email-preview'),
    btnCopyEmailRecap: document.getElementById('btn-copy-email-recap'),
    btnRestart: document.getElementById('btn-restart'),

    // Email Drawer elements
    emailDrawerBackdrop: document.getElementById('email-drawer-backdrop'),
    emailDrawer: document.getElementById('email-drawer'),
    btnCloseEmailDrawer: document.getElementById('btn-close-email-drawer'),
    emailPreviewFrom: document.getElementById('email-preview-from'),
    emailPreviewTo: document.getElementById('email-preview-to'),
    emailPreviewSubject: document.getElementById('email-preview-subject'),
    emailPreviewDate: document.getElementById('email-preview-date'),
    emailPreviewBody: document.getElementById('email-preview-body'),
    btnCopyDrawerHtml: document.getElementById('btn-copy-drawer-html'),
    btnMailtoTrigger: document.getElementById('btn-mailto-trigger'),

    // Help Modal elements
    btnHelpModal: document.getElementById('btn-help-modal'),
    helpModalBackdrop: document.getElementById('help-modal-backdrop'),
    btnCloseHelp: document.getElementById('btn-close-help'),
    btnCloseHelpConfirm: document.getElementById('btn-close-help-confirm'),

    // Toast container
    toastContainer: document.getElementById('toast-container')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    // Detect if running inside Chrome/Edge Extension Popup
    if (window.chrome && chrome.runtime && chrome.runtime.id) {
        document.documentElement.classList.add('extension-popup');
    }
    loadSettings();
    setupEventListeners();
    
    // Auto-check for active transcript buffers from extension
    checkForExtensionTranscript();

    // Initialize Sign In / Sign Up testing module
    setupAuthentication();
});

// Sync saved settings to backend server config
async function syncConfigToServer() {
    try {
        const config = {
            geminiKey: appState.geminiKey,
            todoistToken: appState.todoistToken,
            emailProvider: appState.emailProvider,
            resendKey: appState.resendKey,
            emailFrom: appState.emailFrom,
            smtpHost: appState.smtpHost,
            smtpPort: appState.smtpPort,
            smtpUser: appState.smtpUser,
            smtpPass: appState.smtpPass
        };
        
        await fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ config })
        });
    } catch (e) {
        console.error('[Synapse] Failed to sync config to server:', e);
    }
}

// Load Settings from LocalStorage & sync with backend config
async function loadSettings() {
    let savedParsed = null;
    const saved = localStorage.getItem('synapse_settings');
    if (saved) {
        try {
            savedParsed = JSON.parse(saved);
        } catch (e) {
            console.error('Failed to parse local settings', e);
        }
    }

    try {
        // Fetch shared deployment configuration from the server
        const res = await fetch('/api/config');
        const serverData = await res.json().catch(() => ({}));
        
        if (serverData && serverData.hasSharedConfig) {
            // Server has default credentials configured! Default to Live API mode
            appState.mode = savedParsed?.mode || 'live';
            
            // Set placeholders to indicate shared config is active
            elements.geminiKeyInput.placeholder = "•••••••• (Using shared deployment key)";
            elements.resendKeyInput.placeholder = "•••••••• (Using shared deployment key)";
            elements.todoistTokenInput.placeholder = "•••••••• (Using shared deployment key)";
            
            // Load server values if client has nothing stored locally
            appState.emailProvider = savedParsed?.emailProvider || serverData.emailProvider || 'resend';
            appState.emailFrom = savedParsed?.emailFrom || serverData.emailFrom || '';
            appState.emailRecipients = savedParsed?.emailRecipients || serverData.emailRecipients || '';
            appState.teamDirectory = savedParsed?.teamDirectory || serverData.teamDirectory || '';
            appState.emailSenderName = savedParsed?.emailSenderName || serverData.emailSenderName || 'You';
        } else {
            // No shared config on the server. Default to demo mode
            appState.mode = savedParsed?.mode || 'demo';
            appState.emailProvider = savedParsed?.emailProvider || 'resend';
            appState.emailFrom = savedParsed?.emailFrom || '';
            appState.emailRecipients = savedParsed?.emailRecipients || '';
            appState.teamDirectory = savedParsed?.teamDirectory || '';
            appState.emailSenderName = savedParsed?.emailSenderName || 'You';
        }

        // Fill in client local storage values if they exist
        if (savedParsed) {
            appState.geminiKey = savedParsed.geminiKey || '';
            appState.todoistToken = savedParsed.todoistToken || '';
            appState.resendKey = savedParsed.resendKey || '';
            appState.smtpHost = savedParsed.smtpHost || '';
            appState.smtpPort = savedParsed.smtpPort || '';
            appState.smtpUser = savedParsed.smtpUser || '';
            appState.smtpPass = savedParsed.smtpPass || '';
        }

        // Populate forms
        elements.geminiKeyInput.value = appState.geminiKey;
        elements.todoistTokenInput.value = appState.todoistToken;
        elements.emailProviderInput.value = appState.emailProvider;
        elements.resendKeyInput.value = appState.resendKey;
        elements.emailFromInput.value = appState.emailFrom;
        elements.smtpHostInput.value = appState.smtpHost;
        elements.smtpPortInput.value = appState.smtpPort;
        elements.smtpUserInput.value = appState.smtpUser;
        elements.smtpPassInput.value = appState.smtpPass;
        elements.emailRecipientsInput.value = appState.emailRecipients;
        elements.teamDirectoryInput.value = appState.teamDirectory;
        elements.emailSenderNameInput.value = appState.emailSenderName;

        updateModeUI();
        updateEmailProviderUI();
        
        // Sync local settings to the server config
        syncConfigToServer();

    } catch (err) {
        console.error('Failed to initialize settings from server', err);
    }
}

// Save Settings to LocalStorage
function saveSettings() {
    appState.geminiKey = elements.geminiKeyInput.value.trim();
    appState.todoistToken = elements.todoistTokenInput.value.trim();
    appState.emailProvider = elements.emailProviderInput.value;
    appState.resendKey = elements.resendKeyInput.value.trim();
    appState.emailFrom = elements.emailFromInput.value.trim();
    appState.smtpHost = elements.smtpHostInput.value.trim();
    appState.smtpPort = elements.smtpPortInput.value.trim();
    appState.smtpUser = elements.smtpUserInput.value.trim();
    appState.smtpPass = elements.smtpPassInput.value.trim();
    appState.emailRecipients = elements.emailRecipientsInput.value.trim();
    appState.teamDirectory = elements.teamDirectoryInput.value.trim();
    appState.emailSenderName = elements.emailSenderNameInput.value.trim() || 'You';

    localStorage.setItem('synapse_settings', JSON.stringify({
        mode: appState.mode,
        geminiKey: appState.geminiKey,
        todoistToken: appState.todoistToken,
        emailProvider: appState.emailProvider,
        resendKey: appState.resendKey,
        emailFrom: appState.emailFrom,
        smtpHost: appState.smtpHost,
        smtpPort: appState.smtpPort,
        smtpUser: appState.smtpUser,
        smtpPass: appState.smtpPass,
        emailRecipients: appState.emailRecipients,
        teamDirectory: appState.teamDirectory,
        emailSenderName: appState.emailSenderName
    }));

    // Sync saved settings to server config
    syncConfigToServer();

    showToast('Configuration saved successfully!', 'success');

    // Save button micro-animation feedback
    const btn = elements.btnSaveSettings;
    if (btn) {
        const icon = btn.querySelector('i');
        if (icon) {
            const origClass = icon.className;
            btn.classList.add('btn-copied-glow');
            icon.className = 'fa-solid fa-check check-pop';
            setTimeout(() => {
                btn.classList.remove('btn-copied-glow');
                icon.className = origClass;
            }, 1500);
        }
    }
}

// Update UI based on execution mode
function updateModeUI() {
    if (appState.mode === 'demo') {
        elements.btnDemoMode.classList.add('active');
        elements.btnLiveMode.classList.remove('active');
        elements.credentialsSection.classList.add('disabled');
        elements.modeBadge.textContent = 'Demo Mode';
        elements.modeBadge.classList.add('active-demo');
        elements.modeBadge.classList.remove('live');
        elements.modeDescText.textContent = 'Uses simulated AI parsing, Mock Todoist endpoints, and local email logs. Perfect for quick testing.';
    } else {
        elements.btnDemoMode.classList.remove('active');
        elements.btnLiveMode.classList.add('active');
        elements.credentialsSection.classList.remove('disabled');
        elements.modeBadge.textContent = 'Live API';
        elements.modeBadge.classList.remove('active-demo');
        elements.modeBadge.classList.add('live');
        elements.modeDescText.textContent = 'Triggers real Gemini LLM requests, creates actual tasks in Todoist, and prepares real drafts.';
    }
}

// Update settings view based on email provider
function updateEmailProviderUI() {
    const val = elements.emailProviderInput.value;
    if (val === 'resend') {
        elements.emailResendSection.classList.remove('hidden');
        elements.emailSmtpSection.classList.add('hidden');
    } else {
        elements.emailResendSection.classList.add('hidden');
        elements.emailSmtpSection.classList.remove('hidden');
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Tab Toggles
    if (elements.tabWorkspace && elements.tabLogs) {
        elements.tabWorkspace.addEventListener('click', () => switchTab('workspace'));
        elements.tabLogs.addEventListener('click', () => switchTab('logs'));
    }

    // Mode toggles
    elements.btnDemoMode.addEventListener('click', () => {
        appState.mode = 'demo';
        updateModeUI();
    });

    elements.btnLiveMode.addEventListener('click', () => {
        appState.mode = 'live';
        updateModeUI();
    });

    // Email provider toggle
    elements.emailProviderInput.addEventListener('change', updateEmailProviderUI);

    // Save Settings
    elements.btnSaveSettings.addEventListener('click', saveSettings);

    // Password view toggles
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', (e) => {
            const input = e.currentTarget.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                e.currentTarget.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
            } else {
                input.type = 'password';
                e.currentTarget.innerHTML = '<i class="fa-solid fa-eye"></i>';
            }
        });
    });

    // Load Demo Data
    elements.btnInsertDemo.addEventListener('click', () => {
        elements.notesInput.value = `"Okay so for the launch — Kaustubh, can you finalize the pricing page by Thursday. Also we still need someone to test the checkout flow, maybe Ekam can pick that up early next week. And I'll follow up with the vendor about the contract, hopefully by Friday."`;
        showToast('Demo meeting notes loaded!', 'info');
    });

    // Step 1 -> Step 2: Parse Notes
    elements.btnParseNotes.addEventListener('click', handleParseNotes);

    // Step 2 controls
    elements.btnAddTaskRow.addEventListener('click', addTaskRow);
    elements.btnBackToInput.addEventListener('click', () => showStep('step-input'));
    elements.btnExecuteAutomations.addEventListener('click', handleExecuteAutomations);

    // Outbox & Restart actions
    elements.btnOpenEmailPreview.addEventListener('click', openEmailDrawer);
    elements.btnCloseEmailDrawer.addEventListener('click', closeEmailDrawer);
    elements.emailDrawerBackdrop.addEventListener('click', closeEmailDrawer);
    elements.btnCopyEmailRecap.addEventListener('click', copyEmailRecapToClipboard);
    elements.btnCopyDrawerHtml.addEventListener('click', copyDrawerHtml);
    elements.btnMailtoTrigger.addEventListener('click', triggerMailtoLink);
    elements.btnRestart.addEventListener('click', () => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            elements.notesInput.value = '';
            showStep('step-input');
            return;
        }

        anime({
            targets: '#step-confirm',
            opacity: [1, 0],
            translateY: [0, 20],
            duration: 300,
            easing: 'easeInQuad',
            complete: () => {
                // Reset properties for subsequent entries
                document.getElementById('step-confirm').style.opacity = '';
                anime.set('#step-confirm', { translateY: 0 });
                elements.notesInput.value = '';
                showStep('step-input');
            }
        });
    });

    // Help Modals
    elements.btnHelpModal.addEventListener('click', () => {
        elements.helpModalBackdrop.classList.add('active');
    });
    const hideHelp = () => elements.helpModalBackdrop.classList.remove('active');
    elements.btnCloseHelp.addEventListener('click', hideHelp);
    elements.btnCloseHelpConfirm.addEventListener('click', hideHelp);
}

// Switch step views
function showStep(stepId) {
    elements.stepInput.classList.remove('active');
    elements.stepReview.classList.remove('active');
    elements.stepConfirm.classList.remove('active');

    document.getElementById(stepId).classList.add('active');
}

// Toast notification helper
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = '<i class="fa-solid fa-circle-info"></i>';
    if (type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';
    if (type === 'error') icon = '<i class="fa-solid fa-circle-exclamation"></i>';

    toast.innerHTML = `
        ${icon}
        <div class="toast-content">${message}</div>
    `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// STEP 1: Parse notes handler
async function handleParseNotes() {
    const text = elements.notesInput.value.trim();
    if (!text) {
        showToast('Please provide some meeting notes or text first.', 'error');
        return;
    }

    appState.originalNotes = text;
    
    // Add loading state to button
    const btn = elements.btnParseNotes;
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Running automated pipeline...';

    // Prepare structured raw transcript payload
    let rawTranscript = appState.rawTranscript;
    if (!rawTranscript || rawTranscript.length === 0) {
        // Construct mockup raw transcript structures from manually pasted text lines
        rawTranscript = text.split('\n').filter(line => line.trim()).map((line, idx) => {
            const timeStr = new Date(Date.now() - (15 - idx) * 60000).toTimeString().split(' ')[0];
            const match = line.match(/^\[(\d{2}:\d{2}:\d{2})\]\s*([^:]+):\s*(.*)/);
            if (match) {
                return { timestamp: match[1], speaker: match[2].trim(), text: match[3].trim() };
            }
            return { timestamp: timeStr, speaker: "You", text: line.trim() };
        });
    }

    try {
        const response = await fetch('/api/meetings/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rawTranscript: rawTranscript,
                mode: appState.mode,
                geminiKey: appState.geminiKey
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server returned status ${response.status}`);
        }

        const data = await response.json();
        if (data && data.success && data.meeting) {
            appState.currentMeeting = data.meeting;
            appState.extractedTasks = data.meeting.tasks;
            
            console.log("[Synapse] Created meeting log record:", appState.currentMeeting);
            
            // Sync up contact directory settings
            syncContactDirectory();
            
            // Refresh pending badges count
            updatePendingBadgeCount();
        }

        renderReviewTable();
        resolveRecipientsFromTranscript(text);
        showStep('step-review');
        showToast(`Pipeline success! Extracted ${appState.extractedTasks.length} tasks and logged to history.`, 'success');
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Error occurred while analyzing notes.', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = origHtml;
    }
}

// Mock parsing engine for Demo Mode
function simulateParsing(text) {
    // Check if the user is testing the default launch meeting example
    const normalizedText = text.toLowerCase();
    if (normalizedText.includes('kaustubh') && normalizedText.includes('ekam') && normalizedText.includes('vendor')) {
        return [
            { task: "Finalize pricing page", owner: "Kaustubh", due_date: "Thursday" },
            { task: "Test checkout flow", owner: "Ekam", due_date: "Early next week" },
            { task: "Follow up with vendor about contract", owner: "You", due_date: "Friday" }
        ];
    }

    const items = [];
    const lines = text.split(/\r?\n/);
    
    lines.forEach(line => {
        let owner = "You";
        
        // Extract speaker from the timestamp prefix [HH:MM:SS] Speaker:
        const speakerMatch = line.match(/^\[\d{2}:\d{2}:\d{2}\]\s*([^:]+):\s*/);
        if (speakerMatch) {
            const rawSpeaker = speakerMatch[1].trim();
            if (rawSpeaker.toLowerCase() === 'you') {
                owner = "You";
            } else {
                owner = rawSpeaker.charAt(0).toUpperCase() + rawSpeaker.slice(1).toLowerCase();
            }
        }

        // Clean and strip the [HH:MM:SS] Speaker: prefix
        let cleanLine = line.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*[^:]+:\s*/, '').trim();
        
        // Remove standard bullet points and list indicators
        cleanLine = cleanLine.replace(/^[\s•\-\*\d\.\)]+/, '').trim();
        if (!cleanLine) return;

        // Fallback to name matching inside text if no prefix speaker was matched
        if (!speakerMatch) {
            const nameMatches = cleanLine.match(/(Kaustubh|Ekam|Deepanshu|Amit|Neha|Siddharth|Utkarsh|Sarah|John|Priyanka|Lisa)/i);
            if (nameMatches) {
                owner = nameMatches[0].charAt(0).toUpperCase() + nameMatches[0].slice(1).toLowerCase();
            } else if (cleanLine.toLowerCase().includes('someone') || cleanLine.toLowerCase().includes('need to test')) {
                owner = "Unassigned";
            }
        }

        // Due date extraction
        let due = "Next week";
        if (cleanLine.toLowerCase().includes('thursday')) due = "Thursday";
        else if (cleanLine.toLowerCase().includes('friday')) due = "Friday";
        else if (cleanLine.toLowerCase().includes('monday')) due = "Monday";
        else if (cleanLine.toLowerCase().includes('tomorrow')) due = "Tomorrow";
        else if (cleanLine.toLowerCase().includes('next week')) due = "Next week";
        else if (cleanLine.toLowerCase().includes('today')) due = "Today";

        // Filter lines that look like questions or conversational chatter
        if (cleanLine.length > 5 && (
            cleanLine.toLowerCase().includes('should') ||
            cleanLine.toLowerCase().includes('can you') ||
            cleanLine.toLowerCase().includes('will') ||
            cleanLine.toLowerCase().includes('need to') ||
            cleanLine.toLowerCase().includes('finalize') ||
            cleanLine.toLowerCase().includes('test') ||
            cleanLine.toLowerCase().includes('follow up') ||
            cleanLine.toLowerCase().includes('currently') || // support capture demo line
            cleanLine.toLowerCase().includes('hello')
        )) {
            items.push({
                task: cleanLine.substring(0, 80),
                owner: owner,
                due_date: due
            });
        }
    });

    // If we extracted nothing, inject 2 basic cards so the user gets a working demo
    if (items.length === 0) {
        items.push(
            { task: "Review transcripts & extract action items", owner: "You", due_date: "Today" },
            { task: "Add custom team members and dates", owner: "Team", due_date: "Monday" }
        );
    }

    return items;
}

// Call Real Gemini API
async function callGeminiAPI(notes) {
    const prompt = `You are a structured action-item extraction assistant. Analyze the following meeting notes and return a strict JSON array of extracted action items.
Each action item MUST have:
- "task": string, the action item description.
- "owner": string, the name of the owner (capitalized, e.g. "Priya"). If unassigned, write "Unassigned". If it refers to "I", use "You".
- "due_date": string, a friendly due date (e.g. "Thursday", "Early next week", "2026-07-10").

Return ONLY the JSON array. Do not put markdown blocks (like \`\`\`json ... \`\`\`). Do not add any chat or preamble. Just return the JSON list.

Meeting Notes:
${notes}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${appState.geminiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Gemini API call failed with status: ${response.status}`);
    }

    const data = await response.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Clean response in case markdown wrappers are present
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
            throw new Error('AI output is not a list. Expected a JSON array of tasks.');
        }
        return parsed.map(item => ({
            task: item.task || 'Unnamed action item',
            owner: item.owner || 'Unassigned',
            due_date: item.due_date || 'TBD'
        }));
    } catch (e) {
        console.error('Raw content:', text);
        throw new Error('Failed to parse AI output as JSON array. Raw content: ' + text.substring(0, 100));
    }
}

// Render extracted tasks in editable table
function renderReviewTable() {
    elements.reviewTableBody.innerHTML = '';
    appState.extractedTasks.forEach((item, index) => {
        addRowToTable(item.task, item.owner, item.due_date, index);
    });
}

// Add a single task row to the review table DOM
function addRowToTable(taskText = '', ownerText = '', dueText = '', index) {
    const tr = document.createElement('tr');
    tr.dataset.index = index;
    
    tr.innerHTML = `
        <td><input type="text" class="table-input task-text-input" value="${taskText}" placeholder="Task Description..."></td>
        <td><input type="text" class="table-input owner-text-input" value="${ownerText}" placeholder="Priya, Raj, You..."></td>
        <td><input type="text" class="table-input due-text-input" value="${dueText}" placeholder="Thursday, Early next week..."></td>
        <td style="text-align: center;">
            <button class="btn-delete-row" title="Delete action item"><i class="fa-solid fa-trash-can"></i></button>
        </td>
    `;

    // Row Delete event listener
    tr.querySelector('.btn-delete-row').addEventListener('click', () => {
        tr.remove();
        showToast('Task removed from review list.', 'info');
    });

    elements.reviewTableBody.appendChild(tr);
}

// Add empty task row button handler
function addTaskRow() {
    const rowCount = elements.reviewTableBody.children.length;
    addRowToTable('', 'Unassigned', 'Today', rowCount);
}

// Read current values from the review table into appState
function collectReviewedTasks() {
    const tasks = [];
    const rows = elements.reviewTableBody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const taskVal = row.querySelector('.task-text-input').value.trim();
        const ownerVal = row.querySelector('.owner-text-input').value.trim();
        const dueVal = row.querySelector('.due-text-input').value.trim();
        
        if (taskVal) {
            tasks.push({
                task: taskVal,
                owner: ownerVal || 'Unassigned',
                due_date: dueVal || 'Today'
            });
        }
    });

    return tasks;
}

// STEP 2 -> STEP 3: Execute Automations
async function handleExecuteAutomations() {
    const reviewedTasks = collectReviewedTasks();
    if (reviewedTasks.length === 0) {
        showToast('Please add at least one task to automate.', 'error');
        return;
    }

    appState.extractedTasks = reviewedTasks;

    const btn = elements.btnExecuteAutomations;
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Triggering Automations...';

    try {
        let results = [];
        if (appState.mode === 'demo') {
            await new Promise(resolve => setTimeout(resolve, 2000));
            results = simulateTodoistCreation(reviewedTasks);
            showToast('Simulation: Todoist tasks created and summary generated!', 'success');
        } else {
            if (!appState.todoistToken) {
                throw new Error('Todoist API token is required in Live Mode. Check the settings panel on the left.');
            }
            results = await createRealTodoistTasks(reviewedTasks);
            showToast(`Successfully created ${results.length} tasks in Todoist!`, 'success');

            // Send real email via local Express server
            if (appState.emailProvider === 'smtp' ? (appState.smtpHost && appState.smtpUser && appState.smtpPass) : appState.resendKey) {
                try {
                    await sendEmailViaBackend();
                } catch (emailErr) {
                    console.error('Email sending failed:', emailErr);
                    showToast(`Todoist tasks created, but email failed: ${emailErr.message}`, 'error');
                }
            } else {
                showToast('No email provider credentials configured. Email was simulated only.', 'info');
            }
        }

        // Animate button success state
        btn.classList.add('btn-copied-glow');
        btn.innerHTML = '<span>Automations Completed!</span> <i class="fa-solid fa-check check-pop"></i>';
        
        await new Promise(resolve => setTimeout(resolve, 700));

        renderConfirmationScreen(results);
        showStep('step-confirm');
    } catch (e) {
        console.error(e);
        showToast(e.message || 'Failed to complete automation tasks.', 'error');
    } finally {
        btn.disabled = false;
        btn.classList.remove('btn-copied-glow');
        btn.innerHTML = origHtml;
    }
}

// Send real email through local backend server
async function sendEmailViaBackend() {
    const recipients = elements.emailRecipientsInput.value.trim();
    if (!recipients) {
        showToast('No email recipients specified. Skipping email delivery.', 'info');
        return;
    }

    const emailHtml = generateEmailHTML();
    const bodyObj = {
        emailProvider: appState.emailProvider,
        to: recipients.split(',').map(e => e.trim()),
        subject: 'Meeting Action Recap & Summary',
        html: emailHtml
    };

    if (appState.emailProvider === 'resend') {
        bodyObj.apiKey = appState.resendKey;
        bodyObj.from = elements.emailFromInput.value.trim() || 'onboarding@resend.dev';
    } else {
        bodyObj.smtpHost = appState.smtpHost;
        bodyObj.smtpPort = appState.smtpPort || '465';
        bodyObj.smtpUser = appState.smtpUser;
        bodyObj.smtpPass = appState.smtpPass;
    }

    const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyObj)
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Local server returned error: ${response.status}`);
    }

    showToast('Recap email sent successfully via Resend API!', 'success');
}

// Mock Todoist creation links
function simulateTodoistCreation(tasks) {
    return tasks.map((item, idx) => {
        const randomId = Math.floor(Math.random() * 9000000000) + 1000000000;
        return {
            ...item,
            url: `https://todoist.com/showTask?id=${randomId}`,
            created: true
        };
    });
}

// Create tasks using Todoist REST API
async function createRealTodoistTasks(tasks) {
    // 1. Get or Create "Meeting Action Items" Project
    let projectId = null;
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appState.todoistToken}`
    };

    try {
        const projResponse = await fetch('https://api.todoist.com/rest/v2/projects', { headers });
        if (projResponse.ok) {
            const projects = await projResponse.json();
            const targetProj = projects.find(p => p.name.toLowerCase() === 'meeting action items');
            if (targetProj) {
                projectId = targetProj.id;
            }
        }
    } catch (err) {
        console.warn("Could not fetch projects, creating in Inbox...", err);
    }

    if (!projectId) {
        try {
            const createProjResponse = await fetch('https://api.todoist.com/rest/v2/projects', {
                method: 'POST',
                headers,
                body: JSON.stringify({ name: 'Meeting Action Items' })
            });
            if (createProjResponse.ok) {
                const newProj = await createProjResponse.json();
                projectId = newProj.id;
            }
        } catch (err) {
            console.warn("Could not create dedicated project. Creating tasks directly in Inbox.", err);
        }
    }

    // 2. Create tasks one by one
    const results = [];
    for (const item of tasks) {
        const bodyObj = {
            content: item.task,
            description: `Assigned to: ${item.owner}\nExtracted by Synapse Meeting Copilot.`,
            labels: ['meeting-action-item']
        };

        if (projectId) {
            bodyObj.project_id = projectId;
        }

        // Handle due date strings elegantly
        if (item.due_date) {
            // Check if it's YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(item.due_date)) {
                bodyObj.due_date = item.due_date;
            } else {
                bodyObj.due_string = item.due_date;
            }
        }

        try {
            const taskResponse = await fetch('https://api.todoist.com/rest/v2/tasks', {
                method: 'POST',
                headers,
                body: JSON.stringify(bodyObj)
            });

            if (taskResponse.ok) {
                const createdTask = await taskResponse.json();
                results.push({
                    ...item,
                    url: createdTask.url || `https://todoist.com/showTask?id=${createdTask.id}`,
                    created: true
                });
            } else {
                throw new Error(`Todoist rejected task: ${taskResponse.statusText}`);
            }
        } catch (err) {
            console.error('Failed to create task:', item, err);
            // Push task but mark it failed or point to inbox
            results.push({
                ...item,
                url: `https://todoist.com/app/today`,
                created: false,
                error: err.message
            });
        }
    }

    return results;
}

// Render confirmation Step 3
function renderConfirmationScreen(results) {
    // Before Panel text (raw conversational lines or notes block)
    if (appState.rawTranscript && appState.rawTranscript.length > 0) {
        elements.confirmBeforeText.innerHTML = appState.rawTranscript.map(line => `
            <div class="transcript-line" style="margin-bottom: 8px; font-family: var(--font-mono); font-size: 0.82rem; border-bottom: 1px dashed rgba(255,255,255,0.02); padding-bottom: 4px; text-align: left;">
                <span style="color: var(--text-muted); font-size: 0.72rem; margin-right: 6px;">[${line.timestamp}]</span>
                <span style="color: var(--accent-indigo); font-weight: 600; margin-right: 6px;">${line.speaker}:</span>
                <span style="color: var(--text-primary);">${line.text}</span>
            </div>
        `).join('');
    } else {
        elements.confirmBeforeText.textContent = appState.originalNotes;
    }

    // Adjust Todoist description
    if (appState.mode === 'live') {
        elements.todoistOutcomeDesc.innerHTML = `Created tasks directly in your Todoist Project <strong>"Meeting Action Items"</strong> (or Inbox).`;
    } else {
        elements.todoistOutcomeDesc.innerHTML = `Simulated task database entries generated. Connect Todoist token in Settings to try live integration.`;
    }

    // Render task link buttons
    elements.todoistLinksContainer.innerHTML = '';
    results.forEach(item => {
        const link = document.createElement('a');
        link.href = item.url;
        link.target = '_blank';
        link.rel = 'noopener';
        link.className = 'todoist-task-link reveal-item';
        
        let statusIcon = '<i class="fa-solid fa-list-check"></i>';
        if (!item.created) {
            statusIcon = '<i class="fa-solid fa-triangle-exclamation" style="color: #f43f5e;"></i>';
        }

        link.innerHTML = `
            ${statusIcon}
            <span><strong>${item.owner}</strong>: ${item.task} (Due: ${item.due_date})</span>
            <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.7em; margin-left: auto;"></i>
        `;
        elements.todoistLinksContainer.appendChild(link);
    });

    // Populate Outbox Drawer Data
    populateEmailDrawerContent();

    // Trigger Upgraded Anime.js Reveal Sequence
    runRevealSequence();
}

// Upgraded anime.js Reveal Animation Sequence (Local, CSP & Extension compliant)
function runRevealSequence() {
    const beforePanel = document.querySelector('.before-panel');
    const afterPanel = document.querySelector('.after-panel');
    const divider = document.querySelector('.reveal-divider');
    const sweepPulse = document.querySelector('.sweep-pulse');
    const revealItems = document.querySelectorAll('.reveal-item');
    const todoistCard = document.querySelector('#todoist-outcome-card');

    // Remove any previous active glow classes
    afterPanel.classList.remove('active-glow');
    if (todoistCard) {
        todoistCard.classList.remove('active-glow');
    }

    // 1. Graceful degradation check (Reduced Motion preferred)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        beforePanel.style.opacity = '1';
        beforePanel.style.transform = 'none';
        divider.style.opacity = '1';
        afterPanel.style.opacity = '1';
        afterPanel.classList.add('active-glow');
        if (todoistCard) {
            todoistCard.classList.add('active-glow');
        }
        revealItems.forEach(el => {
            el.style.opacity = '1';
            el.style.transform = 'none';
        });
        anime.set('.checkmark-circle', { strokeDashoffset: 0 });
        anime.set('.checkmark-check', { strokeDashoffset: 0 });
        anime.set(['.reveal-header', '.reveal-desc'], { opacity: 1, translateY: 0 });
        anime.set('.check-badge', { scale: 1 });
        return;
    }

    // Set initial layout states using anime.set to prevent layout flash
    anime.set([beforePanel, divider, afterPanel, '.reveal-header', '.reveal-desc'], { opacity: 0 });
    anime.set(revealItems, { opacity: 0, translateY: 15 });
    anime.set('.checkmark-circle', { strokeDashoffset: 157 });
    anime.set('.checkmark-check', { strokeDashoffset: 48 });
    anime.set('.check-badge', { scale: 0 });
    if (sweepPulse) {
        anime.set(sweepPulse, { opacity: 0, left: '-120px', top: '0' });
    }

    const isExtension = document.documentElement.classList.contains('extension-popup');

    // 2. Build and run anime.js animation timeline
    const timeline = anime.timeline({
        easing: 'easeOutQuad'
    });

    // Step A: Draw-on checkmark circle (400ms)
    timeline.add({
        targets: '.checkmark-circle',
        strokeDashoffset: [157, 0],
        duration: 400,
        easing: 'easeOutQuad'
    });

    // Step B: Draw-on checkmark check path (300ms)
    timeline.add({
        targets: '.checkmark-check',
        strokeDashoffset: [48, 0],
        duration: 300,
        easing: 'easeOutQuad'
    }, '-=150');

    // Step C: Fade & slide in Headline + Subtitle (350ms)
    timeline.add({
        targets: ['.reveal-header', '.reveal-desc'],
        opacity: [0, 1],
        translateY: [15, 0],
        duration: 350,
        easing: 'easeOutCubic'
    }, '-=150');

    // Step D: Fade & slide in Before Panel + Divider (300ms)
    timeline.add({
        targets: [beforePanel, divider],
        opacity: [0, 1],
        translateX: isExtension ? 0 : [-15, 0],
        translateY: isExtension ? [-15, 0] : 0,
        duration: 300
    }, '-=200');

    // Step E: Trigger scanning sweep glow pulse across panels (350ms / 450ms)
    if (sweepPulse) {
        timeline.add({
            targets: sweepPulse,
            opacity: {
                value: [0, 1, 1, 0],
                duration: isExtension ? 350 : 450,
                easing: 'linear'
            },
            left: isExtension ? '0' : ['-120px', '100%'],
            top: isExtension ? ['-120px', '100%'] : '0',
            duration: isExtension ? 350 : 450,
            easing: 'easeOutCubic'
        }, '-=50');
    }

    // Step F: Trigger After Panel Reveal (overlaps with sweep scan)
    timeline.add({
        targets: afterPanel,
        opacity: [0, 1],
        duration: 250,
        complete: () => {
            // Start pulsing glow rings once the panel reveals
            afterPanel.classList.add('active-glow');
            if (todoistCard) {
                todoistCard.classList.add('active-glow');
            }
        }
    }, isExtension ? '-=200' : '-=300');

    // Step G: Staggered reveal of task rows and outbox details
    timeline.add({
        targets: revealItems,
        opacity: [0, 1],
        translateY: [15, 0],
        delay: anime.stagger(isExtension ? 30 : 50),
        duration: 400,
        easing: 'easeOutCubic'
    }, '-=150');

    // Step H: Pop-in checkmark success badge with overshoot animation
    timeline.add({
        targets: '.check-badge',
        scale: [0, 1],
        duration: 400,
        easing: 'easeOutBack'
    }, '-=150');
}

// Generate the beautiful HTML email content
function generateEmailHTML() {
    const sender = elements.emailSenderNameInput.value.trim() || 'You';
    const rows = appState.extractedTasks.map(item => `
        <tr>
            <td style="border: 1px solid #edf2f7; padding: 12px; font-weight: 500; color: #2d3748;">${item.task}</td>
            <td style="border: 1px solid #edf2f7; padding: 12px; color: #4a5568; font-weight: 600; text-align: center;">${item.owner}</td>
            <td style="border: 1px solid #edf2f7; padding: 12px; color: #718096; text-align: center;">${item.due_date}</td>
        </tr>
    `).join('');

    return `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #edf2f7; border-radius: 12px; background-color: #ffffff;">
            <div style="text-align: center; margin-bottom: 24px; border-bottom: 2px solid #f7fafc; padding-bottom: 20px;">
                <h1 style="color: #4f46e5; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.01em;">Meeting Action Recap</h1>
                <p style="color: #718096; margin: 6px 0 0 0; font-size: 13px;">Follow-up task assignments and deadlines</p>
            </div>
            
            <p style="color: #2d3748; font-size: 15px; line-height: 1.5; margin-bottom: 16px;">Hi team,</p>
            <p style="color: #4a5568; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
                Thanks for syncing today. Here is the action board and ownership breakdown we aligned on. All items have been published directly to our team task backlog.
            </p>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <thead>
                    <tr style="background-color: #f7fafc; border-bottom: 2px solid #edf2f7;">
                        <th style="border: 1px solid #edf2f7; padding: 12px; text-align: left; color: #4a5568; font-size: 12px; font-weight: 700; text-transform: uppercase;">Action Item</th>
                        <th style="border: 1px solid #edf2f7; padding: 12px; text-align: center; color: #4a5568; font-size: 12px; font-weight: 700; text-transform: uppercase; width: 120px;">Owner</th>
                        <th style="border: 1px solid #edf2f7; padding: 12px; text-align: center; color: #4a5568; font-size: 12px; font-weight: 700; text-transform: uppercase; width: 120px;">Due Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>

            <p style="color: #4a5568; font-size: 14px; line-height: 1.5; margin-bottom: 20px;">
                Please review your cards in Todoist and mark them complete as they are done. Let me know if we need to adjust any owners or timelines.
            </p>

            <div style="border-top: 1px solid #f7fafc; padding-top: 18px; margin-top: 20px; font-size: 14px; color: #4a5568;">
                Best regards,<br>
                <strong>${sender}</strong>
            </div>

            <div style="margin-top: 32px; border-top: 1px solid #edf2f7; padding-top: 12px; text-align: center;">
                <span style="font-size: 11px; color: #a0aec0; letter-spacing: 0.05em; text-transform: uppercase;">Generated autonomously by Synapse AI Copilot</span>
            </div>
        </div>
    `;
}

// Generate the plain text copy version of the email summary
function generateEmailPlainText() {
    const sender = elements.emailSenderNameInput.value.trim() || 'You';
    const lines = appState.extractedTasks.map(item => `• ${item.task} | Owner: ${item.owner} | Due: ${item.due_date}`).join('\n');
    
    return `Hi team,

Thanks for syncing today. Here is the action board and ownership breakdown we aligned on from our meeting:

${lines}

Please review your items in Todoist. Let me know if any adjustments are needed.

Best regards,
${sender}

--
Generated autonomously by Synapse AI Copilot`;
}

// Populate drawer content
function populateEmailDrawerContent() {
    const recipients = elements.emailRecipientsInput.value.trim() || 'team@company.com';
    const sender = elements.emailSenderNameInput.value.trim() || 'You';

    elements.emailPreviewFrom.textContent = `${sender} via Synapse Copilot <agent@synapse.ai>`;
    elements.emailPreviewTo.textContent = recipients;
    elements.emailPreviewSubject.textContent = 'Action Items & Meeting Summary';
    elements.emailPreviewDate.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    elements.emailPreviewBody.innerHTML = generateEmailHTML();
}

// Drawer and Copy Utility Functions
function openEmailDrawer() {
    populateEmailDrawerContent();
    elements.emailDrawerBackdrop.style.display = 'block';
    // Small delay to trigger sliding transitions
    setTimeout(() => {
        elements.emailDrawer.classList.add('active');
    }, 10);
}

function closeEmailDrawer() {
    elements.emailDrawer.classList.remove('active');
    setTimeout(() => {
        elements.emailDrawerBackdrop.style.display = 'none';
    }, 300);
}

function copyEmailRecapToClipboard() {
    const text = generateEmailPlainText();
    navigator.clipboard.writeText(text)
        .then(() => {
            showToast('Summary copied to clipboard as text!', 'success');
            morphCopyButton(elements.btnCopyEmailRecap);
        })
        .catch(() => showToast('Failed to copy summary to clipboard.', 'error'));
}

function copyDrawerHtml() {
    const html = generateEmailHTML();
    navigator.clipboard.writeText(html)
        .then(() => {
            showToast('Email HTML code copied to clipboard!', 'success');
            morphCopyButton(elements.btnCopyDrawerHtml);
        })
        .catch(() => showToast('Failed to copy HTML code.', 'error'));
}

// Open mail client with prefilled mailto link
function triggerMailtoLink() {
    const recipients = encodeURIComponent(elements.emailRecipientsInput.value.trim() || 'team@company.com');
    const subject = encodeURIComponent('Action Items & Meeting Summary');
    const body = encodeURIComponent(generateEmailPlainText());
    
    const mailtoUrl = `mailto:${recipients}?subject=${subject}&body=${body}`;
    window.open(mailtoUrl, '_blank');
}

// Morph copy button feedback state helper
function morphCopyButton(btn) {
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (!icon) return;
    
    const originalClass = icon.className;
    btn.classList.add('btn-copied-glow');
    icon.className = 'fa-solid fa-check check-pop';
    
    setTimeout(() => {
        btn.classList.remove('btn-copied-glow');
        icon.className = originalClass;
    }, 2000);
}

// Check for active transcripts from the meeting browser extension
async function checkForExtensionTranscript() {
    // Skip if running inside the extension popup container
    if (document.documentElement.classList.contains('extension-popup')) return;

    try {
        const response = await fetch('/api/latest-transcript');
        if (!response.ok) return;

        const data = await response.json();
        if (data && data.transcript) {
            console.log("[Synapse Dashboard] Loaded meeting transcript from extension cache.");
            
            if (data.transcript.meetingId) {
                showToast("New meeting captured from call! Opening log details...", "success");
                
                // Toggle to logs view
                switchTab('logs');
                
                // Focus the newly generated meeting record
                setTimeout(() => {
                    loadMeetingsList(data.transcript.meetingId);
                }, 500);
            } else {
                elements.notesInput.value = data.transcript.prose;
                appState.originalNotes = data.transcript.prose;
                appState.rawTranscript = data.transcript.raw;
                showToast("Transcript retrieved from extension! Triggering AI analysis...", "success");
                setTimeout(handleParseNotes, 1200);
            }
        }
    } catch (err) {
        console.warn("Error checking for active transcripts:", err);
    }
}

// Automatically resolve and fill recipient emails based on who spoke in the meeting
function resolveRecipientsFromTranscript(text) {
    if (!elements.teamDirectoryInput || !elements.emailRecipientsInput) return;

    // 1. Parse Team Directory text area mapping
    const directory = {};
    const dirLines = elements.teamDirectoryInput.value.split('\n');
    dirLines.forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
            const name = parts[0].trim().toLowerCase();
            const email = parts[1].trim();
            if (name && email) {
                directory[name] = email;
            }
        }
    });

    // 2. Collect unique speaker names
    const speakers = new Set();
    
    if (appState.rawTranscript && appState.rawTranscript.length > 0) {
        // Highly accurate speaker list from the browser extension
        appState.rawTranscript.forEach(line => {
            if (line.speaker) {
                speakers.add(line.speaker.trim().toLowerCase());
            }
        });
    } else {
        // Fallback: search for known name keywords in manual pasted notes
        const nameMatches = text.matchAll(/(Kaustubh|Ekam|Deepanshu|Amit|Neha|Siddharth|Utkarsh|Sarah|John|Priyanka|Lisa)/ig);
        for (const match of nameMatches) {
            speakers.add(match[0].toLowerCase());
        }
    }

    // 3. Resolve emails from the directory (with loose matching and self-email fallbacks)
    const resolvedEmails = [];
    speakers.forEach(speaker => {
        if (speaker === 'you') {
            // Map "you" to your own email address configured in credentials
            const userEmail = appState.smtpUser || appState.emailFrom;
            if (userEmail && userEmail.includes('@')) {
                resolvedEmails.push(userEmail);
                return;
            }
        }

        // Loose name matching (handles "Kaustubh Dixit" matching "Kaustubh")
        let foundEmail = null;
        for (const dirName in directory) {
            if (speaker.includes(dirName) || dirName.includes(speaker)) {
                foundEmail = directory[dirName];
                break;
            }
        }

        if (foundEmail) {
            resolvedEmails.push(foundEmail);
        }
    });

    // 4. Fill Recipients input field if any emails resolved
    if (resolvedEmails.length > 0) {
        elements.emailRecipientsInput.value = resolvedEmails.join(', ');
        appState.emailRecipients = elements.emailRecipientsInput.value;
        console.log(`[Synapse] Auto-resolved recipient emails: ${elements.emailRecipientsInput.value}`);
    }
}

// Setup Sign In / Sign Up mock authentication logic
function setupAuthentication() {
    if (!elements.authContainer) return;

    // Seed default testing account if no users array exists
    let users = JSON.parse(localStorage.getItem('synapse_users') || '[]');
    if (users.length === 0) {
        users.push({
            email: 'admin@synapse.ai',
            password: 'password123',
            name: 'Admin Tester'
        });
        localStorage.setItem('synapse_users', JSON.stringify(users));
    }

    // Toggle password visibility on forms
    document.querySelectorAll('#auth-container .toggle-password').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const input = e.currentTarget.previousElementSibling;
            if (input.type === 'password') {
                input.type = 'text';
                e.currentTarget.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
            } else {
                input.type = 'password';
                e.currentTarget.innerHTML = '<i class="fa-solid fa-eye"></i>';
            }
        });
    });

    // Form switches
    elements.linkShowSignup.addEventListener('click', (e) => {
        e.preventDefault();
        anime({
            targets: elements.formSignin,
            opacity: [1, 0],
            translateY: [0, -10],
            duration: 200,
            easing: 'easeInQuad',
            complete: () => {
                elements.formSignin.classList.add('hidden');
                elements.formSignup.classList.remove('hidden');
                anime({
                    targets: elements.formSignup,
                    opacity: [0, 1],
                    translateY: [10, 0],
                    duration: 250,
                    easing: 'easeOutQuad'
                });
            }
        });
    });

    elements.linkShowSignin.addEventListener('click', (e) => {
        e.preventDefault();
        anime({
            targets: elements.formSignup,
            opacity: [1, 0],
            translateY: [0, -10],
            duration: 200,
            easing: 'easeInQuad',
            complete: () => {
                elements.formSignup.classList.add('hidden');
                elements.formSignin.classList.remove('hidden');
                anime({
                    targets: elements.formSignin,
                    opacity: [0, 1],
                    translateY: [10, 0],
                    duration: 250,
                    easing: 'easeOutQuad'
                });
            }
        });
    });

    // Sign In Submission
    elements.formSignin.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = elements.signinEmail.value.trim().toLowerCase();
        const password = elements.signinPassword.value.trim();

        // Query registered users list
        const registeredUsers = JSON.parse(localStorage.getItem('synapse_users') || '[]');
        const matchedUser = registeredUsers.find(u => u.email === email && u.password === password);

        if (matchedUser) {
            sessionStorage.setItem('synapse_auth_session', JSON.stringify(matchedUser));
            showToast(`Welcome back, ${matchedUser.name}!`, 'success');
            transitionAuthToDashboard();
        } else {
            showToast('Invalid email or password.', 'error');
        }
    });

    // Sign Up Submission
    elements.formSignup.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = elements.signupName.value.trim();
        const email = elements.signupEmail.value.trim().toLowerCase();
        const password = elements.signupPassword.value.trim();

        if (password.length < 6) {
            showToast('Password must be at least 6 characters long.', 'error');
            return;
        }

        const registeredUsers = JSON.parse(localStorage.getItem('synapse_users') || '[]');
        if (registeredUsers.some(u => u.email === email)) {
            showToast('Email address already registered.', 'error');
            return;
        }

        // Add user to database
        registeredUsers.push({ name, email, password });
        localStorage.setItem('synapse_users', JSON.stringify(registeredUsers));

        showToast('Account created successfully! Please Sign In.', 'success');
        elements.linkShowSignin.click(); // switch back
        
        // Reset signup inputs
        elements.signupName.value = '';
        elements.signupEmail.value = '';
        elements.signupPassword.value = '';
    });

    // Quick Login
    elements.btnQuickLogin.addEventListener('click', () => {
        elements.signinEmail.value = 'admin@synapse.ai';
        elements.signinPassword.value = 'password123';
        elements.formSignin.dispatchEvent(new Event('submit'));
    });

    // Sign Out
    elements.btnSignOut.addEventListener('click', () => {
        sessionStorage.removeItem('synapse_auth_session');
        showToast('Signed out successfully.', 'info');
        
        // Animate exit to login overlay
        anime({
            targets: '.app-container',
            opacity: [1, 0],
            translateY: [0, 20],
            duration: 300,
            easing: 'easeInQuad',
            complete: () => {
                document.querySelector('.app-container').classList.add('hidden');
                elements.authContainer.classList.remove('hidden');
                
                // Reset inputs
                elements.signinEmail.value = '';
                elements.signinPassword.value = '';
                
                anime({
                    targets: elements.authContainer,
                    opacity: [0, 1],
                    scale: [1.05, 1],
                    duration: 350,
                    easing: 'easeOutCubic'
                });
            }
        });
    });

    // Check current session on load
    const activeSession = sessionStorage.getItem('synapse_auth_session');
    if (activeSession) {
        // Logged in
        document.querySelector('.app-container').classList.remove('hidden');
        elements.authContainer.classList.add('hidden');
    } else {
        // Logged out
        document.querySelector('.app-container').classList.add('hidden');
        elements.authContainer.classList.remove('hidden');
        anime.set(elements.authContainer, { opacity: 1, scale: 1 });
    }
}

// Custom page transition animation
function transitionAuthToDashboard() {
    anime({
        targets: elements.authContainer,
        opacity: [1, 0],
        scale: [1, 0.95],
        duration: 300,
        easing: 'easeInQuad',
        complete: () => {
            elements.authContainer.classList.add('hidden');
            document.querySelector('.app-container').classList.remove('hidden');
            
            // Animate dashboard entrance
            anime({
                targets: '.app-container',
                opacity: [0, 1],
                translateY: [20, 0],
                duration: 400,
                easing: 'easeOutCubic',
                complete: () => {
                    // Update initial pending badges on logs tab once inside
                    updatePendingBadgeCount();
                }
            });
        }
    });
}

// Sync contact directory from text area config settings to backend DB file
async function syncContactDirectory() {
    if (!elements.teamDirectoryInput) return;
    
    const contacts = [];
    const dirLines = elements.teamDirectoryInput.value.split('\n');
    dirLines.forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 2) {
            const name = parts[0].trim();
            const email = parts[1].trim();
            if (name && email) {
                contacts.push({
                    name: name,
                    email: email,
                    aliases: [name.toLowerCase(), name.toLowerCase() + ' sharma', name.toLowerCase() + ' patel']
                });
            }
        }
    });

    const userEmail = appState.smtpUser || appState.emailFrom;
    if (userEmail && userEmail.includes('@')) {
        contacts.push({
            name: "You",
            email: userEmail,
            aliases: ["you", "me"]
        });
    }

    try {
        await fetch('/api/contacts/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacts })
        });
        console.log("[Synapse] Synced contact registry settings directory with backend.");
    } catch (e) {
        console.warn("Failed to sync contact registry:", e);
    }
}

// Fetch meeting counts and update pending notifications badge on logs tab
async function updatePendingBadgeCount() {
    if (!elements.logsPendingBadge) return;
    try {
        const response = await fetch('/api/meetings');
        if (!response.ok) return;
        const data = await response.json();
        if (data && data.meetings) {
            const pendingCount = data.meetings.filter(m => m.status === 'pending_review').length;
            if (pendingCount > 0) {
                elements.logsPendingBadge.textContent = pendingCount;
                elements.logsPendingBadge.style.display = 'inline-block';
            } else {
                elements.logsPendingBadge.style.display = 'none';
            }
        }
    } catch (e) {
        console.warn("Failed to update pending logs badge count:", e);
    }
}

// Toggle navigation views between the main Workspace and history Meeting Logs
function switchTab(tab) {
    if (!elements.tabWorkspace || !elements.tabLogs || !elements.workspaceView || !elements.logsView) return;

    if (tab === 'workspace') {
        elements.tabWorkspace.classList.add('active');
        elements.tabWorkspace.style.background = 'rgba(99, 102, 241, 0.15)';
        elements.tabWorkspace.style.borderColor = 'rgba(99, 102, 241, 0.3)';
        elements.tabWorkspace.style.color = '#fff';

        elements.tabLogs.classList.remove('active');
        elements.tabLogs.style.background = 'transparent';
        elements.tabLogs.style.borderColor = 'var(--border-color)';
        elements.tabLogs.style.color = 'var(--text-secondary)';

        elements.workspaceView.classList.remove('hidden');
        elements.logsView.classList.add('hidden');
    } else {
        elements.tabLogs.classList.add('active');
        elements.tabLogs.style.background = 'rgba(99, 102, 241, 0.15)';
        elements.tabLogs.style.borderColor = 'rgba(99, 102, 241, 0.3)';
        elements.tabLogs.style.color = '#fff';

        elements.tabWorkspace.classList.remove('active');
        elements.tabWorkspace.style.background = 'transparent';
        elements.tabWorkspace.style.borderColor = 'var(--border-color)';
        elements.tabWorkspace.style.color = 'var(--text-secondary)';

        elements.workspaceView.classList.add('hidden');
        elements.logsView.classList.remove('hidden');

        // Sync contacts settings to backend registry first
        syncContactDirectory();
        
        // Refresh and render history meetings list
        loadMeetingsList();
    }
}

// Fetch and render list of meeting timeline logs in Logs view
async function loadMeetingsList(selectedId = null) {
    if (!elements.meetingsList) return;

    try {
        const response = await fetch('/api/meetings');
        if (!response.ok) throw new Error("Failed to fetch meetings history list.");
        const data = await response.json();
        
        elements.meetingsList.innerHTML = '';
        const meetings = data.meetings || [];

        if (meetings.length === 0) {
            elements.meetingsList.innerHTML = `<p class="text-muted" style="font-size: 0.85rem; text-align: center; margin-top: 20px;">No meeting logs parsed yet.</p>`;
            return;
        }

        // Keep track of meetings locally on appState for faster detail lookups
        appState.meetings = meetings;

        meetings.forEach(meeting => {
            const card = document.createElement('div');
            card.className = `meeting-log-card glass-panel ${selectedId === meeting.id ? 'active' : ''}`;
            
            // Build custom card styles
            card.style.padding = '12px 16px';
            card.style.borderRadius = '8px';
            card.style.border = selectedId === meeting.id ? '1px solid var(--accent-indigo)' : '1px solid var(--border-color)';
            card.style.background = selectedId === meeting.id ? 'rgba(99, 102, 241, 0.08)' : 'rgba(0, 0, 0, 0.15)';
            card.style.cursor = 'pointer';
            card.style.transition = 'var(--transition-smooth)';
            
            let statusBadge = '';
            if (meeting.status === 'pending_review') {
                statusBadge = `<span style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); color: #f59e0b; font-size: 0.65rem; padding: 2px 8px; border-radius: 99px; font-weight: 600;">Pending Review</span>`;
            } else if (meeting.status === 'sent') {
                statusBadge = `<span style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; font-size: 0.65rem; padding: 2px 8px; border-radius: 99px; font-weight: 600;">Sent</span>`;
            } else if (meeting.status === 'failed_some' || meeting.status === 'failed') {
                statusBadge = `<span style="background: rgba(244, 63, 94, 0.15); border: 1px solid rgba(244, 63, 94, 0.3); color: #f43f5e; font-size: 0.65rem; padding: 2px 8px; border-radius: 99px; font-weight: 600;">Delivery Failed</span>`;
            } else {
                statusBadge = `<span style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); color: var(--text-secondary); font-size: 0.65rem; padding: 2px 8px; border-radius: 99px; font-weight: 600;">Processed</span>`;
            }

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                    <h4 style="margin: 0; font-size: 0.9rem; color: #fff; font-family: var(--font-heading); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; max-width: 170px;">${meeting.title}</h4>
                    ${statusBadge}
                </div>
                <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
                    <i class="fa-regular fa-clock"></i> ${meeting.timestamp}
                </div>
            `;

            // Hover styles
            card.addEventListener('mouseenter', () => {
                if (selectedId !== meeting.id) {
                    card.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    card.style.background = 'rgba(255, 255, 255, 0.05)';
                }
            });
            card.addEventListener('mouseleave', () => {
                if (selectedId !== meeting.id) {
                    card.style.borderColor = 'var(--border-color)';
                    card.style.background = 'rgba(0, 0, 0, 0.15)';
                }
            });

            card.addEventListener('click', () => {
                // Focus this card
                document.querySelectorAll('.meeting-log-card').forEach(c => {
                    c.style.borderColor = 'var(--border-color)';
                    c.style.background = 'rgba(0, 0, 0, 0.15)';
                });
                card.style.borderColor = 'var(--accent-indigo)';
                card.style.background = 'rgba(99, 102, 241, 0.08)';

                loadMeetingDetails(meeting.id);
            });

            elements.meetingsList.appendChild(card);
        });

        // Automatically load details of the first meeting if selectedId is null
        if (meetings.length > 0 && !selectedId) {
            loadMeetingDetails(meetings[0].id);
        } else if (selectedId) {
            loadMeetingDetails(selectedId);
        }
        
        // Refresh pending badges count
        updatePendingBadgeCount();

    } catch (e) {
        showToast("Error retrieving logs: " + e.message, "error");
    }
}

// Render meeting transcript, summary details, and outbox approvals inside right panel
function loadMeetingDetails(id) {
    if (!appState.meetings) return;
    const meeting = appState.meetings.find(m => m.id === id);
    if (!meeting) return;

    elements.selectedMeetingEmpty.classList.add('hidden');
    elements.selectedMeetingContent.classList.remove('hidden');

    // Build raw vs clean split display
    let rawLinesHtml = '';
    meeting.rawTranscript.forEach(line => {
        rawLinesHtml += `
            <div style="font-size: 0.8rem; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.02); padding-bottom: 4px;">
                <strong style="color: var(--accent-indigo); font-size: 0.72rem;">[${line.timestamp}] ${line.speaker}:</strong>
                <span style="color: var(--text-secondary);">${line.text}</span>
            </div>
        `;
    });

    let cleanTextLinesHtml = '';
    const cleanLines = meeting.cleanTranscriptRaw || [];
    cleanLines.forEach(line => {
        cleanTextLinesHtml += `
            <div style="font-size: 0.8rem; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.02); padding-bottom: 4px;">
                <strong style="color: var(--accent-violet); font-size: 0.72rem;">[${line.timestamp}] ${line.speaker}:</strong>
                <span style="color: #fff;">${line.text}</span>
            </div>
        `;
    });

    // Build key decisions list
    const decisionsHtml = meeting.decisions.length > 0
        ? meeting.decisions.map(d => `<li style="font-size: 0.82rem; margin-bottom: 4px;">${d}</li>`).join('')
        : '<li style="font-size: 0.82rem;" class="text-muted">No key decisions captured.</li>';

    // Build tasks & email statuses outbox registry rows
    let recipientsTableRows = '';
    meeting.tasks.forEach(t => {
        let statusBadge = '';
        let actionBtn = '';

        if (t.emailStatus === 'sent') {
            statusBadge = `<span style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; font-size: 0.68rem; padding: 2px 8px; border-radius: 99px; font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Sent</span>`;
            actionBtn = `<button class="btn btn-secondary btn-sm" onclick="resendRecapEmail('${meeting.id}', '${t.email}')" style="padding: 2px 8px; font-size: 0.7rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer;"><i class="fa-solid fa-arrow-rotate-left"></i> Resend</button>`;
        } else if (t.emailStatus === 'failed') {
            statusBadge = `<span style="background: rgba(244, 63, 94, 0.15); border: 1px solid rgba(244, 63, 94, 0.3); color: #f43f5e; font-size: 0.68rem; padding: 2px 8px; border-radius: 99px; font-weight: 600;"><i class="fa-solid fa-circle-exclamation"></i> Failed</span>`;
            actionBtn = `<button class="btn btn-primary btn-sm" onclick="resendRecapEmail('${meeting.id}', '${t.email}')" style="padding: 2px 8px; font-size: 0.7rem; border-radius: 4px; background: var(--accent-rose); border-color: var(--accent-rose); display: inline-flex; align-items: center; gap: 4px; cursor: pointer; color: #fff;"><i class="fa-solid fa-rotate-left"></i> Retry</button>`;
        } else if (t.emailStatus === 'missing_email') {
            statusBadge = `<span style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); color: #f59e0b; font-size: 0.68rem; padding: 2px 8px; border-radius: 99px; font-weight: 600;">Missing Email</span>`;
            actionBtn = `<input type="email" placeholder="Add email & save" onchange="updateMissingEmail('${meeting.id}', '${t.owner}', this.value)" style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); color:#fff; border-radius:4px; padding: 2px 6px; font-size: 0.7rem; width: 140px; box-sizing: border-box;">`;
        } else {
            statusBadge = `<span style="background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); color: var(--text-secondary); font-size: 0.68rem; padding: 2px 8px; border-radius: 99px; font-weight: 600;">Pending Approval</span>`;
            actionBtn = `<span class="text-muted" style="font-size: 0.7rem;">Waiting...</span>`;
        }

        recipientsTableRows += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                <td style="padding: 8px 12px; font-size: 0.8rem; color:#fff;"><strong>${t.owner}</strong></td>
                <td style="padding: 8px 12px; font-size: 0.8rem; color: var(--text-secondary); font-family: var(--font-mono);">${t.email || '<span style="color: var(--accent-amber);">Not configured</span>'}</td>
                <td style="padding: 8px 12px; font-size: 0.8rem; white-space: nowrap;">${t.task}</td>
                <td style="padding: 8px 12px; font-size: 0.8rem; text-align: center;">${statusBadge}</td>
                <td style="padding: 8px 12px; font-size: 0.8rem; text-align: center;">${actionBtn}</td>
            </tr>
        `;
    });

    // Build Approve recap panel box
    let approveBannerHtml = '';
    if (meeting.status === 'pending_review') {
        approveBannerHtml = `
            <div style="background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 8px; padding: 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <div>
                    <h4 style="margin: 0; color: #fff; font-size: 0.95rem; font-family: var(--font-heading);">Verify and Dispatch Meeting Recap</h4>
                    <p style="margin: 4px 0 0 0; font-size: 0.75rem; color: var(--text-secondary);">Clicking approve constructs personalized dashboards and emails them to all assigned participants.</p>
                </div>
                <button class="btn btn-primary" id="btn-approve-meeting" onclick="approveMeetingRecap('${meeting.id}')" style="cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 0 15px rgba(99, 102, 241, 0.4); padding: 8px 16px; font-size: 0.82rem; border-radius: 6px;">
                    <i class="fa-solid fa-square-check"></i> Approve & Send Recaps
                </button>
            </div>
        `;
    } else if (meeting.status === 'sending') {
        approveBannerHtml = `
            <div style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 8px; padding: 16px; display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
                <i class="fa-solid fa-circle-notch fa-spin" style="color: var(--accent-amber);"></i>
                <span style="font-size: 0.82rem; color: var(--accent-amber);">Currently dispatching mail recaps in queue. Please wait...</span>
            </div>
        `;
    } else {
        approveBannerHtml = `
            <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 0.82rem; color: #10b981;">
                <i class="fa-solid fa-circle-check"></i> Recap emails are processed. Status: ${meeting.status.toUpperCase()}.
            </div>
        `;
    }

    elements.selectedMeetingContent.innerHTML = `
        <!-- Title and Metadata -->
        <div style="border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
            <h2 style="margin: 0; font-family: var(--font-heading); color: #fff; font-size: 1.35rem;">${meeting.title}</h2>
            <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; gap: 15px; margin-top: 6px;">
                <span><i class="fa-regular fa-calendar"></i> logged: ${meeting.timestamp}</span>
                <span><i class="fa-solid fa-hashtag"></i> ID: ${meeting.id}</span>
            </div>
        </div>

        <!-- Approval Box -->
        ${approveBannerHtml}

        <!-- Side-by-side comparative split -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <!-- Left Panel: Raw Captions -->
            <div style="background: rgba(0, 0, 0, 0.2); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; height: 180px; overflow-y: auto; box-sizing: border-box;">
                <h4 style="margin: 0 0 10px 0; font-size: 0.75rem; text-transform: uppercase; color: var(--text-muted); font-family: var(--font-mono); font-weight: 700; letter-spacing: 0.05em;"><i class="fa-solid fa-microphone-slash"></i> Raw captured captions</h4>
                ${rawLinesHtml}
            </div>

            <!-- Right Panel: Cleaned Output -->
            <div style="background: rgba(99, 102, 241, 0.02); border: 1px solid rgba(99, 102, 241, 0.15); border-radius: 8px; padding: 12px; height: 180px; overflow-y: auto; box-sizing: border-box;">
                <h4 style="margin: 0 0 10px 0; font-size: 0.75rem; text-transform: uppercase; color: var(--accent-violet); font-family: var(--font-mono); font-weight: 700; letter-spacing: 0.05em;"><i class="fa-solid fa-wand-magic-sparkles"></i> Cleaned & glossary corrected</h4>
                ${cleanTextLinesHtml}
            </div>
        </div>

        <!-- Summary & decisions -->
        <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 16px;">
            <div style="background: rgba(0,0,0,0.15); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px;">
                <h4 style="margin-top: 0; color: #fff; font-family: var(--font-heading); margin-bottom: 10px; font-size: 0.9rem;"><i class="fa-solid fa-list"></i> Meeting Summary</h4>
                <p style="margin: 0; font-size: 0.82rem; line-height: 1.5; color: var(--text-secondary);">${meeting.summary}</p>
            </div>
            <div style="background: rgba(0,0,0,0.15); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px;">
                <h4 style="margin-top: 0; color: #fff; font-family: var(--font-heading); margin-bottom: 10px; font-size: 0.9rem;"><i class="fa-solid fa-lightbulb"></i> Key Decisions</h4>
                <ul style="margin: 0; padding-left: 20px; color: var(--text-secondary);">
                    ${decisionsHtml}
                </ul>
            </div>
        </div>

        <!-- Participant and Tasks Mailer Table -->
        <div style="margin-top: 10px;">
            <h4 style="margin-top: 0; color: #fff; font-family: var(--font-heading); margin-bottom: 8px; font-size: 0.9rem;"><i class="fa-regular fa-paper-plane"></i> Outbox Recipient Delivery Status</h4>
            <div style="border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; background: rgba(0,0,0,0.15);">
                <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                        <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid var(--border-color);">
                            <th style="padding: 10px 12px; font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Participant</th>
                            <th style="padding: 10px 12px; font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Email</th>
                            <th style="padding: 10px 12px; font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Task details</th>
                            <th style="padding: 10px 12px; font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; text-align: center;">Delivery</th>
                            <th style="padding: 10px 12px; font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; text-align: center;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${recipientsTableRows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Approve the meeting log and trigger email outbox dispatches on the server
async function approveMeetingRecap(id) {
    const btn = document.getElementById('btn-approve-meeting');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Dispatching...';
    }

    try {
        const payload = {
            emailProvider: appState.emailProvider,
            resendKey: appState.resendKey,
            emailFrom: appState.emailFrom,
            emailSenderName: appState.emailSenderName,
            globalRecipients: appState.emailRecipients,
            smtpSettings: {
                smtpHost: appState.smtpHost,
                smtpPort: appState.smtpPort,
                smtpUser: appState.smtpUser,
                smtpPass: appState.smtpPass
            }
        };

        const response = await fetch(`/api/meetings/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Server error ${response.status}`);
        }

        const data = await response.json();
        if (data && data.success) {
            showToast("Recap emails dispatched successfully!", "success");
            loadMeetingsList(id);
        }
    } catch (e) {
        showToast("Dispatch failed: " + e.message, "error");
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-square-check"></i> Approve & Send Recaps';
        }
    }
}

// Retry sending an email recap to a specific failed address
async function resendRecapEmail(id, email) {
    showToast(`Retrying email recap for ${email}...`, "info");
    try {
        const payload = {
            email: email,
            emailProvider: appState.emailProvider,
            resendKey: appState.resendKey,
            emailFrom: appState.emailFrom,
            smtpSettings: {
                smtpHost: appState.smtpHost,
                smtpPort: appState.smtpPort,
                smtpUser: appState.smtpUser,
                smtpPass: appState.smtpPass
            }
        };

        const response = await fetch(`/api/meetings/${id}/resend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`Server error ${response.status}`);
        const data = await response.json();
        
        if (data && data.success) {
            showToast(`Recap successfully re-sent to ${email}!`, "success");
            loadMeetingsList(id);
        } else {
            throw new Error(data.error || "Retry failed.");
        }
    } catch (e) {
        showToast(`Retry failed for ${email}: ` + e.message, "error");
    }
}

// Update missing email on tasks and save in contacts registry database
async function updateMissingEmail(meetingId, owner, email) {
    if (!email || !email.includes('@')) {
        showToast("Please enter a valid email address.", "error");
        return;
    }
    
    showToast(`Adding email for ${owner}...`, "info");
    try {
        const resContacts = await fetch('/api/contacts');
        const dataContacts = await resContacts.json();
        const contacts = dataContacts.contacts || [];

        const ownerLower = owner.toLowerCase();
        let matched = contacts.find(c => c.name.toLowerCase() === ownerLower);
        if (matched) {
            matched.email = email;
        } else {
            contacts.push({
                name: owner,
                email: email,
                aliases: [ownerLower]
            });
        }

        await fetch('/api/contacts/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacts })
        });

        const directoryLines = elements.teamDirectoryInput.value.split('\n');
        directoryLines.push(`${owner}: ${email}`);
        elements.teamDirectoryInput.value = directoryLines.join('\n');
        saveSettings();

        showToast(`Email for ${owner} updated. Processing changes...`, "success");
        loadMeetingsList(meetingId);

    } catch (e) {
        showToast("Failed to save email: " + e.message, "error");
    }
}

// Expose dashboard callbacks globally for inline HTML trigger clicks
window.approveMeetingRecap = approveMeetingRecap;
window.resendRecapEmail = resendRecapEmail;
window.updateMissingEmail = updateMissingEmail;

