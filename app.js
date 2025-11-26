// app.js
import { setupAuth } from './auth.js';
import { db, collection, addDoc, getDocs, query, orderBy, Timestamp } from './firebase-init.js';

// --- State Management ---
const state = {
    currentStep: 1,
    findings: [],
    companies: []
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    setupAuth();
    setupNavigation();
    setupFormNavigation();
    setupFindingsLogic();
    setupFormSubmission();

    // Listen for login to load data
    window.addEventListener('user-logged-in', () => {
        loadDashboardData();
    });
});

// --- Navigation ---
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-links li');
    const views = document.querySelectorAll('.view');
    const pageTitle = document.getElementById('page-title');

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const viewId = link.dataset.view;
            views.forEach(v => v.classList.remove('active'));
            document.getElementById(`view-${viewId}`).classList.add('active');

            pageTitle.textContent = link.querySelector('span:last-child').textContent;
        });
    });

    document.getElementById('new-btn').addEventListener('click', () => {
        document.querySelector('[data-view="new-inspection"]').click();
    });

    document.getElementById('sync-btn').addEventListener('click', () => {
        loadDashboardData();
    });
}

// --- Form Logic ---
function setupFormNavigation() {
    window.nextStep = (step) => {
        document.querySelectorAll('.form-section').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));

        const sections = ['section-facility', 'section-data', 'section-review'];
        document.getElementById(sections[step - 1]).classList.add('active');

        document.querySelector(`.step[data-step="${step}"]`).classList.add('active');
        state.currentStep = step;

        if (step === 3) updateReviewSummary();
    };

    window.prevStep = (step) => {
        window.nextStep(step);
    };

    window.switchTab = (tabName) => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        const tabs = document.querySelectorAll('.tab');
        if (tabName === 'gsdp') tabs[0].classList.add('active');
        else tabs[1].classList.add('active');

        document.getElementById(`tab-${tabName}`).classList.add('active');
    };
}

// --- Dynamic Findings Logic (Manual Input) ---
function setupFindingsLogic() {
    window.addFindingRow = () => {
        const container = document.getElementById('findings-container');

        const row = document.createElement('div');
        row.className = 'finding-row';
        row.innerHTML = `
            <div class="input-group">
                <label>Observation / Finding</label>
                <textarea class="finding-input" placeholder="Type observation here..."></textarea>
            </div>
            <div class="input-group">
                <label>Classification</label>
                <select class="finding-type">
                    <option value="Others">Others</option>
                    <option value="Major">Major</option>
                    <option value="Critical">Critical</option>
                </select>
            </div>
            <div class="input-group full-width">
                <label>GSDP Guideline Reference</label>
                <textarea class="guideline-output" placeholder="Type relevant GSDP guideline section here..."></textarea>
            </div>
            <button type="button" class="btn-outline" onclick="this.parentElement.remove()" style="color: red; border-color: red;">
                <span class="material-icons-round">delete</span>
            </button>
        `;

        container.appendChild(row);
    };

    // Add one initial row
    window.addFindingRow();
}

function updateReviewSummary() {
    const form = document.getElementById('inspection-form');
    const formData = new FormData(form);
    const summary = document.querySelector('.review-summary');

    summary.innerHTML = `
        <div class="stat-card">
            <h3>Facility</h3>
            <p>${formData.get('facility_name')}</p>
            <p style="font-size: 0.9rem; color: var(--text-muted)">${formData.get('inspection_date')}</p>
        </div>
        <div class="stat-card" style="margin-top: 1rem">
            <h3>Findings Recorded</h3>
            <p>${document.querySelectorAll('.finding-row').length} items</p>
        </div>
    `;
}

// --- Report Generation & Submission ---
function setupFormSubmission() {
    document.getElementById('inspection-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = e.submitter;
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="material-icons-round">hourglass_empty</span> Processing...';

        try {
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            // Gather findings
            const findings = [];
            document.querySelectorAll('.finding-row').forEach(row => {
                findings.push({
                    observation: row.querySelector('.finding-input').value,
                    guideline: row.querySelector('.guideline-output').value,
                    classification: row.querySelector('.finding-type').value
                });
            });

            data.findings = findings;
            data.has_critical = findings.some(f => f.classification === 'Critical');
            data.has_major = findings.some(f => f.classification === 'Major');
            data.timestamp = Timestamp.now();
            data.status = "Completed";

            // Calculate Risk (Simple Logic for now)
            let riskLevel = "Low";
            if (data.has_critical) riskLevel = "High";
            else if (data.has_major) riskLevel = "Medium";
            data.risk_level = riskLevel;

            // 1. Generate Reports
            await generateReports(data);

            // 2. Save to Firestore
            await addDoc(collection(db, "inspections"), data);

            alert("Reports generated and saved to History!");

            e.target.reset();
            window.nextStep(1);
            document.querySelector('[data-view="dashboard"]').click();
            loadDashboardData(); // Refresh dashboard

        } catch (error) {
            console.error(error);
            alert("Error: " + error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });
}

async function generateReports(data) {
    const loadFile = async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to load template: ${url}`);
        return res.arrayBuffer();
    };

    const renderTemplate = (content, data, outputName) => {
        const zip = new PizZip(content);
        const doc = new window.docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
        });

        doc.render(data);

        const out = doc.getZip().generate({
            type: "blob",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        saveAs(out, outputName);
    };

    const templates = [
        { name: 'TEMPLATE.docx', out: `${data.facility_name}_Report.docx` },
        { name: 'TEMPLATE_1.docx', out: `${data.facility_name}_Report_1.docx` },
        { name: 'TEMPLATE_2.docx', out: `${data.facility_name}_Report_2.docx` },
        { name: 'RISK_CATEGORIZATION TEMPLATE.docx', out: `${data.facility_name}_Risk.docx` }
    ];

    for (const t of templates) {
        try {
            const content = await loadFile(t.name);
            renderTemplate(content, data, t.out);
        } catch (err) {
            console.warn(`Skipping ${t.name}: ${err.message}`);
        }
    }
}

// --- Dashboard (History) ---
async function loadDashboardData() {
    const tbody = document.getElementById('dashboard-table-body');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading history...</td></tr>';

    try {
        const q = query(collection(db, "inspections"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);

        tbody.innerHTML = '';
        let total = 0;
        let highRisk = 0;

        querySnapshot.forEach((doc) => {
            const item = doc.data();
            total++;
            if (item.risk_level === 'High') highRisk++;

            const date = item.timestamp ? item.timestamp.toDate().toLocaleDateString() : item.inspection_date;

            const row = `
                <tr>
                    <td>${item.facility_name}</td>
                    <td>${date}</td>
                    <td><span style="color: ${getRiskColor(item.risk_level)}; font-weight: 600;">${item.risk_level}</span></td>
                    <td>${item.status}</td>
                    <td><button class="btn-outline" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">View</button></td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

        // Update Stats
        document.querySelectorAll('.stat-card .value')[0].textContent = total;
        document.querySelectorAll('.stat-card .value')[1].textContent = highRisk;

    } catch (error) {
        console.error("Error loading dashboard:", error);
        tbody.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">Error loading data: ${error.message}</td></tr>`;
    }
}

function getRiskColor(level) {
    if (level === 'High') return '#FF1744';
    if (level === 'Medium') return '#FF9100';
    return '#00C853';
}

window.exportToExcel = () => {
    const table = document.querySelector(".data-table");
    const wb = XLSX.utils.table_to_book(table);
    XLSX.writeFile(wb, "Inspection_History.xlsx");
};
