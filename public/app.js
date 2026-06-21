/**
 * Clinical Matrix Testing Workbench Orchestrator Engine Core
 * Tracks system routes lifecycle validation steps smoothly
 */

const BASE_URL = window.location.origin + '/api';
const logView = document.getElementById('jsonResponseDisplay');
const tokenStatus = document.getElementById('tokenStatus');
const myAppointmentsTable = document.getElementById('myAppointmentsTable');

// 1. Unified Console Logger Output System
function printResponse(status, data) {
    logView.innerText = `HTTP NETWORK STATUS CODE: ${status}\n\nRESPONSE JSON PARSED OBJECT:\n${JSON.stringify(data, null, 2)}`;
}

// 2. Synchronize Token Profile Visualization Blocks
function updateTokenUI() {
    const token = localStorage.getItem('userToken');
    if (token) {
        // Decode payload dynamically to find user information for display logs
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(window.atob(base64));
            tokenStatus.innerText = `🟢 SECURE AUTHORIZATION ACTIVE | Role Sign: [${payload.role.toUpperCase()}] | Extracted ID: ${payload.id}\nJWT: ${token.substring(0, 50)}...`;
            tokenStatus.style.color = "#10b981";
            tokenStatus.style.borderColor = "#10b981";
        } catch (e) {
            tokenStatus.innerText = `🟢 JWT ACTIVE (Unparsed Header Structure):\n${token.substring(0, 70)}...`;
        }
    } else {
        tokenStatus.innerText = "❌ NO SECURITY IDENTITY KEYS RECORDED | Session requests are currently treated as Unauthenticated (Global Desktop Mock)";
        tokenStatus.style.color = "#ef4444";
        tokenStatus.style.borderColor = "#ef4444";
    }
}

// 3. EVENT LISTENERS ASSIGNMENTS MODULE

// A. Patient Signup Execution Loop
document.getElementById('btnRegister').addEventListener('click', async () => {
    try {
        const res = await fetch(`${BASE_URL}/auth/patient/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: document.getElementById('regName').value,
                email: document.getElementById('regEmail').value,
                phone_number: document.getElementById('regPhone').value,
                password: document.getElementById('regPassword').value
            })
        });
        const data = await res.json();
        printResponse(res.status, data);
    } catch (err) { printResponse("NETWORK ERROR EXCEPTION", err.message); }
});

// B. Doctor Signup Execution Loop
document.getElementById('btnDocRegister').addEventListener('click', async () => {
    try {
        const res = await fetch(`${BASE_URL}/auth/doctor/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: document.getElementById('docRegName').value,
                email: document.getElementById('docRegEmail').value,
                specialization_id: parseInt(document.getElementById('docRegSpec').value),
                city: document.getElementById('docRegCity').value,
                password: document.getElementById('docRegPassword').value
            })
        });
        const data = await res.json();
        printResponse(res.status, data);
    } catch (err) { printResponse("NETWORK ERROR EXCEPTION", err.message); }
});

// C. Patient Login Verification Sequence
document.getElementById('btnLogin').addEventListener('click', async () => {
    try {
        const res = await fetch(`${BASE_URL}/auth/patient/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: document.getElementById('loginEmail').value,
                password: document.getElementById('loginPassword').value
            })
        });
        const data = await res.json();
        printResponse(res.status, data);

        if (res.ok && data.token) {
            localStorage.setItem('userToken', data.token);
            updateTokenUI();
        }
    } catch (err) { printResponse("NETWORK ERROR EXCEPTION", err.message); }
});

// D. Doctor Login Verification Sequence
document.getElementById('btnDocLogin').addEventListener('click', async () => {
    try {
        const res = await fetch(`${BASE_URL}/auth/doctor/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: document.getElementById('docLoginEmail').value,
                password: document.getElementById('docLoginPassword').value
            })
        });
        const data = await res.json();
        printResponse(res.status, data);

        if (res.ok && data.token) {
            localStorage.setItem('userToken', data.token);
            updateTokenUI();
        }
    } catch (err) { printResponse("NETWORK ERROR EXCEPTION", err.message); }
});

// E. Transmit Simulated Voice Prompt Input Text Flow
document.getElementById('btnVoice').addEventListener('click', async () => {
    const token = localStorage.getItem('userToken');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
        const res = await fetch(`${BASE_URL}/voice/process`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ text: document.getElementById('voiceText').value })
        });
        const data = await res.json();
        printResponse(res.status, data);
        
        // Dynamic field clearing help for checking fast slots inputs loops
        document.getElementById('voiceText').value = '';
    } catch (err) { printResponse("NETWORK ERROR EXCEPTION", err.message); }
});

// F. Query Protected Records Block Logic (/appointments/my-list)
async function loadProtectedAppointments() {
    const token = localStorage.getItem('userToken');
    if (!token) {
        alert("Action Aborted: Please log in using a profile credentials panel block above first to assign access keys.");
        return;
    }

    try {
        const res = await fetch(`${BASE_URL}/appointments/my-list`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        printResponse(res.status, data);

        if (!res.ok) {
            myAppointmentsTable.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#ef4444; font-weight:bold;">Error Payload: ${data.error}</td></tr>`;
            return;
        }

        if (data.length === 0) {
            myAppointmentsTable.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#64748b;">Zero matching appointment logs mapped for this authenticated identity token signature block.</td></tr>`;
            return;
        }

        myAppointmentsTable.innerHTML = data.map(app => `
            <tr>
                <td><strong>#${app.appointment_id}</strong></td>
                <td>${app.patient_name ? `Patient: ${app.patient_name}` : `Dr. ${app.doctor_name}`}</td>
                <td><span class="badge">${app.specialization || 'General Practice'}</span></td>
                <td><small style="color:#94a3b8;">${app.hospital_address || 'Facility Hub'}</small></td>
                <td><code>${app.date}</code></td>
                <td><code>${app.time}</code></td>
                <td><span class="badge ${app.status.toLowerCase()}">${app.status}</span></td>
                <td>
                    ${app.status.toLowerCase() !== 'cancelled' ? 
                      `<button class="danger" style="font-size:11px; padding:4px 8px;" onclick="triggerCancel(${app.appointment_id})">Cancel Slot</button>` : 
                      `<span style="color:#64748b; font-size:11px; font-style:italic;">Halted</span>`}
                </td>
            </tr>
        `).join('');

    } catch (err) { printResponse("NETWORK ERROR EXCEPTION", err.message); }
}
document.getElementById('btnFetchMyList').addEventListener('click', loadProtectedAppointments);

// G. Runtime Appointment Mutation Cancellation PATCH Execution Trigger
window.triggerCancel = async function(id) {
    const token = localStorage.getItem('userToken');
    if (!token) return;

    if (!confirm(`Are you sure you want to fire the cancellation pipeline query on slot #${id}?`)) return;

    try {
        const res = await fetch(`${BASE_URL}/appointments/cancel/${id}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        printResponse(res.status, data);
        
        // Synchronously re-evaluate database logs visual presentation layout
        loadProtectedAppointments();
    } catch (err) { printResponse("NETWORK ERROR EXCEPTION", err.message); }
};

// H. Wipe Token Session Reset Interface State Clear Action
document.getElementById('btnClearToken').addEventListener('click', () => {
    localStorage.removeItem('userToken');
    updateTokenUI();
    myAppointmentsTable.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#64748b;">Session identity keys cleared. Dashboard data detached.</td></tr>`;
    logView.innerText = "Security token scrubbed out of memory. All subsequent requests are unauthenticated.";
});

// Initialize UI layout tracking loops on load trigger
updateTokenUI();