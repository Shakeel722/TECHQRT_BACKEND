 const micBtn = document.getElementById('micBtn');
const statusText = document.getElementById('statusText');
const transcriptText = document.getElementById('transcriptText');
const replyText = document.getElementById('replyText');
const appointmentTableBody = document.getElementById('appointmentTableBody');
const refreshBtn = document.getElementById('refreshBtn');

// Browser Compatibility Initialization
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
    statusText.innerText = "Error: Web Speech API not supported in this browser.";
    micBtn.disabled = true;
}

const recognition = new SpeechRecognition();
recognition.continuous = false;
recognition.lang = 'en-IN'; 
recognition.interimResults = false;

let isRecording = false;

// ✨ NEW: Welcome announcement sequence on initial landing page load
function announceWelcomeGreeting() {
    const welcomeMessage = "Hello! Welcome to your AI Voice Clinic Assistant. I can help you search for doctors and schedule clinic appointments. How can I help you today?";
    
    // Display the initial introductory prompt visually inside the system response card area
    if (replyText) {
        replyText.innerText = welcomeMessage;
    }
    
    // Add a short delay to ensure browser speech assets are completely awake and initialized
    setTimeout(() => {
        speak(welcomeMessage);
    }, 600);
}

// Attach the layout trigger hook to execute right when the browser window finishes rendering elements
window.addEventListener('load', announceWelcomeGreeting);


// 📋 ✨ NEW: Dashboard Data Fetcher & Renderer
async function loadAppointmentsDashboard() {
    if (!appointmentTableBody) return; // Prevent errors if the element isn't in HTML yet
    
    try {
        const response = await fetch('http://localhost:3000/api/appointments/list');
        const appointments = await response.json();
        
        if (!appointments || appointments.length === 0) {
            appointmentTableBody.innerHTML = `<tr><td colspan="8" class="empty-state">No medical bookings registered yet.</td></tr>`;
            return;
        }

        // Build interactive UI table rows dynamically
        appointmentTableBody.innerHTML = appointments.map(app => `
            <tr>
                <td><strong>#${app.appointment_id}</strong></td>
                <td>${app.patient_name}</td>
                <td>${app.doctor_name}</td>
                <td style="text-transform: capitalize;">${app.specialization}</td>
                <td style="text-transform: capitalize;">${app.city}</td>
                <td>📅 ${app.date}</td>
                <td>⏰ ${app.time}</td>
                <td><span class="badge">${app.status}</span></td>
            </tr>
        `).join('');

    } catch (err) {
        console.error("Dashboard Sync Error:", err);
        appointmentTableBody.innerHTML = `<tr><td colspan="8" class="empty-state" style="color: #ef4444;">Failed to sync data grid rows with PostgreSQL backend context.</td></tr>`;
    }
}

// Attach event triggers for page lifecycle hooks and refresh button
if (refreshBtn) refreshBtn.addEventListener('click', loadAppointmentsDashboard);
window.addEventListener('DOMContentLoaded', loadAppointmentsDashboard);

micBtn.addEventListener('click', () => {
    if (isRecording) {
        recognition.stop();
    } else {
        recognition.start();
    }
});

recognition.onstart = () => {
    isRecording = true;
    micBtn.classList.add('recording');
    statusText.innerText = "Listening closely...";
};

recognition.onend = () => {
    isRecording = false;
    micBtn.classList.remove('recording');
    statusText.innerText = "Processing voice patterns...";
};

recognition.onerror = (event) => {
    statusText.innerText = `Error observed: ${event.error}`;
};

recognition.onresult = async (event) => {
    // FIXED: Safely maps browser speech result matrices
    const speechToTextResult = event.results[0][0].transcript;
    transcriptText.innerText = speechToTextResult;

    try {
        statusText.innerText = "Processing voice patterns...";
        
        const response = await fetch('http://localhost:3000/api/voice/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: speechToTextResult })
        });
        
        const data = await response.json();
        replyText.innerText = data.reply;
        statusText.innerText = "Click to speak";
        
        // Execute speech synthesis pipeline (TTS Output)
        speak(data.reply);

        // ✨ NEW: Automatically trigger an instant dashboard update if a booking succeeded
        if (data.reply.toLowerCase().includes("successfully booked") || data.reply.toLowerCase().includes("confirmed")) {
            setTimeout(loadAppointmentsDashboard, 800);
        }

    } catch (err) {
        replyText.innerText = "Failed to synchronize with server backend context.";
        statusText.innerText = "Click to speak";
    }
};

function speak(message) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // Terminate pending audio cues
    
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    const selectVoice = voices.find(v => v.lang.includes('en')) || voices[0];
    if (selectVoice) utterance.voice = selectVoice;

    window.speechSynthesis.speak(utterance);
}
