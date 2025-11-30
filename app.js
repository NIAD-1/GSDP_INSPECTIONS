// app.js
import { setupAuth } from './auth.js';
import { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, collection, addDoc, getDocs, query, orderBy, Timestamp, deleteDoc, doc } from './firebase-init.js';

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
    setupPersonnelLogic();
    setupFormSubmission();

    // Check for PizZip
    if (!window.PizZip) {
        console.error("PizZip not loaded!");
        alert("Warning: Report generation library (PizZip) failed to load. Please check your internet connection and refresh.");
    }

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

        // Map steps to section IDs
        const sections = ['section-1', 'section-2', 'section-3', 'section-4'];
        const sectionId = sections[step - 1];

        if (sectionId) {
            document.getElementById(sectionId).classList.add('active');
            document.querySelector(`.step[data-step="${step}"]`).classList.add('active');
            state.currentStep = step;
        }

        if (step === 4) updateReviewSummary();
    };

    window.prevStep = (step) => {
        window.nextStep(step);
    };

    window.switchTab = (tabName) => {
        document.querySelectorAll('.tab').forEach(t => {
            t.classList.remove('active');
            if (t.getAttribute('onclick').includes(tabName)) {
                t.classList.add('active');
            }
        });

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
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

// --- Dynamic Personnel Logic ---
function setupPersonnelLogic() {
    window.addPersonnelRow = () => {
        const container = document.getElementById('personnel-container');
        const row = document.createElement('div');
        row.className = 'grid-2';
        row.style.borderBottom = '1px solid var(--border)';
        row.style.paddingBottom = '1rem';
        row.style.marginBottom = '1rem';
        row.innerHTML = `
            <div class="input-group">
                <label>Name</label>
                <input type="text" class="p-name" placeholder="Personnel Name">
            </div>
            <div class="input-group">
                <label>Designation</label>
                <input type="text" class="p-designation" placeholder="e.g. Superintendent Pharmacist">
            </div>
            <div class="input-group">
                <label>Qualification</label>
                <input type="text" class="p-qualification" placeholder="e.g. B.Pharm">
            </div>
            <div class="input-group">
                <label>Phone No.</label>
                <input type="text" class="p-phone" placeholder="Phone Number">
            </div>
            <div class="input-group full-width" style="display: flex; gap: 1rem; align-items: flex-end;">
                <div style="flex: 1;">
                    <label>Email</label>
                    <input type="email" class="p-email" placeholder="Email Address">
                </div>
                <button type="button" class="btn-outline" onclick="this.parentElement.parentElement.remove()" style="color: red; border-color: red; height: 42px;">
                    <span class="material-icons-round">delete</span>
                </button>
            </div>
        `;
        container.appendChild(row);
    };

    // Add initial row
    window.addPersonnelRow();
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
        <div class="stat-card" style="margin-top: 1rem">
            <h3>Personnel Recorded</h3>
            <p>${document.querySelectorAll('#personnel-container .grid-2').length} people</p>
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

            // Helper to format multi-line text as bullet points
            const formatAsBulletedList = (text) => {
                if (!text) return text;
                return text.split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0)
                    .map(line => `• ${line}`)
                    .join('\n');
            };

            // Format Date
            if (data.inspection_date) {
                const dateObj = new Date(data.inspection_date);
                const day = String(dateObj.getDate()).padStart(2, '0');
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const year = dateObj.getFullYear();
                data.inspection_date = `${day}-${month}-${year}`;
                data.date = data.inspection_date; // Alias
            }

            // Log Date (Today's date)
            const today = new Date();
            const tDay = String(today.getDate()).padStart(2, '0');
            const tMonth = String(today.getMonth() + 1).padStart(2, '0');
            const tYear = today.getFullYear();
            data.log_date = `${tDay}-${tMonth}-${tYear}`;

            // --- Robust Data Mapping for Template Compatibility ---

            // 1. Inspector Aliases (Map to common variations)
            data.lead_designation = data.lead_inspector_designation;
            data.lead_rank = data.lead_inspector_designation;

            data.co_designation = data.co_inspector_designation;
            data.co_rank = data.co_inspector_designation;

            data.trainee_designation = data.trainee_inspector_designation;
            data.trainee_rank = data.trainee_inspector_designation;

            // 2. Create Inspectors List (for templates using loops)
            data.inspectors_list = [
                {
                    name: data.lead_inspector,
                    designation: data.lead_inspector_designation,
                    rank: data.lead_inspector_designation,
                    role: "Lead Inspector"
                },
                {
                    name: data.co_inspector,
                    designation: data.co_inspector_designation,
                    rank: data.co_inspector_designation,
                    role: "Co-Inspector"
                }
            ];
            // Add trainees if present
            if (data.trainee_inspector) {
                data.inspectors_list.push({
                    name: data.trainee_inspector,
                    designation: data.trainee_inspector_designation,
                    rank: data.trainee_inspector_designation,
                    role: "Trainee Inspector"
                });
            }
            if (data.trainee_inspector_2) {
                data.inspectors_list.push({
                    name: data.trainee_inspector_2,
                    rank: data.trainee_inspector_2_designation,
                    role: "Trainee Inspector"
                });
            }

            // Apply bullet formatting to specific fields
            const bulletFields = [
                'activities_info', 'premises_adequacy_info', 'warehouse_info',
                'special_storage_info', 'documentation_info', 'distribution_info',
                'recommendations', 'summary_conclusion', 'inspected_areas',
                'licensing_adherence'
            ];

            bulletFields.forEach(field => {
                if (data[field]) {
                    data[field] = formatAsBulletedList(data[field]);
                }
            });

            // Gather findings with Index and Bullets
            const findings = [];
            let fIndex = 1;
            document.querySelectorAll('.finding-row').forEach(row => {
                const obsText = row.querySelector('.finding-input').value;
                findings.push({
                    index: fIndex++, // 1, 2, 3...
                    observation: formatAsBulletedList(obsText), // Bulleted sub-points
                    guideline: row.querySelector('.guideline-output').value,
                    classification: row.querySelector('.finding-type').value
                });
            });

            // Gather personnel with Aliases
            const personnel = [];
            let pIndex = 1;
            document.querySelectorAll('#personnel-container .grid-2').forEach(row => {
                const pName = row.querySelector('.p-name').value;
                const pDesig = row.querySelector('.p-designation').value;
                const pQual = row.querySelector('.p-qualification').value;
                const pPhone = row.querySelector('.p-phone').value;
                const pEmail = row.querySelector('.p-email').value;

                personnel.push({
                    index: pIndex++,
                    // Standard keys
                    name: pName,
                    designation: pDesig,
                    qualification: pQual,
                    phone: pPhone,
                    email: pEmail,

                    // Aliases for template compatibility
                    personnel_name: pName,
                    personnel_designation: pDesig,
                    personnel_qualification: pQual,
                    personnel_phone: pPhone,
                    personnel_email: pEmail,

                    rank: pDesig // Alias
                });
            });

            // Map personnel to flat fields for template if needed (e.g. first person)
            if (personnel.length > 0) {
                data.facility_personnelname = personnel[0].name;
                data.facility_personneldesignation = personnel[0].designation;
                data.facility_personnelqualification = personnel[0].qualification;
                data.facility_personnelphoneno = personnel[0].phone;
                data.facility_personnelemail = personnel[0].email;
            }
            // Also pass full list for templates that support loops
            data.personnel_list = personnel;
            data.personnel = personnel; // Alias

            data.findings = findings;
            data.has_critical = findings.some(f => f.classification === 'Critical');
            data.has_major = findings.some(f => f.classification === 'Major');

            // Create Summary Lists for Letter Templates (Bulleted Strings)
            const majorList = findings.filter(f => f.classification === 'Critical' || f.classification === 'Major');
            const otherList = findings.filter(f => f.classification !== 'Critical' && f.classification !== 'Major');

            // --- Grouped Findings for CAPA & Report Tables (Numbered) ---
            const formatGrouped = (list) => {
                if (list.length === 0) return "Nil";
                return list.map((f, i) => {
                    // Remove the first bullet if present, so the number takes its place
                    let text = f.observation;
                    if (text.startsWith('• ')) {
                        text = text.substring(2);
                    }
                    return `${i + 1}. ${text}`;
                }).join('\n');
            };

            // Apply Numbered Format to Letter Summaries too
            data.major_findings = formatGrouped(majorList);
            data.other_findings = formatGrouped(otherList);

            data.critical_findings_grouped = formatGrouped(findings.filter(f => f.classification === 'Critical'));
            data.major_findings_grouped = formatGrouped(findings.filter(f => f.classification === 'Major'));
            data.other_findings_grouped = formatGrouped(findings.filter(f => f.classification !== 'Critical' && f.classification !== 'Major'));

            // --- Grouped Guidelines (for Report Table References) ---
            // Matches the numbered order of the findings above
            const formatGuidelines = (list) => {
                if (list.length === 0) return "Nil";
                return list.map((f, i) => `${i + 1}. ${f.guideline}`).join('\n');
            };

            data.critical_guidelines_grouped = formatGuidelines(findings.filter(f => f.classification === 'Critical'));
            data.major_guidelines_grouped = formatGuidelines(findings.filter(f => f.classification === 'Major'));
            data.other_guidelines_grouped = formatGuidelines(findings.filter(f => f.classification !== 'Critical' && f.classification !== 'Major'));

            // --- Risk Categorization Logic ---
            let riskScore = 1; // Default Low
            let riskRating = "C"; // Default Low

            if (data.has_critical) {
                riskScore = 3; // High
                riskRating = "A";
            } else if (data.has_major) {
                riskScore = 2; // Medium
                riskRating = "B";
            }

            data.risk_score = riskScore;
            data.risk_rating = riskRating;

            // "Circle One" Indicators (Unicode for Part B)
            // If selected, use circled number (①, ②, ③). If not, use plain number (1, 2, 3).
            data.risk_circle_1 = riskScore === 1 ? "①" : "1";
            data.risk_circle_2 = riskScore === 2 ? "②" : "2";
            data.risk_circle_3 = riskScore === 3 ? "③" : "3";

            // "Tick One" Indicators (Unicode for Part C)
            // If selected, use Checked Box (☑). If not, use Empty Box (☐).
            data.risk_tick_A = riskRating === "A" ? "☑" : "☐";
            data.risk_tick_B = riskRating === "B" ? "☑" : "☐";
            data.risk_tick_C = riskRating === "C" ? "☑" : "☐";

            // Calculate Risk Frequency (based on user template)
            let riskFrequency = "Increased Freq. once in 6 months"; // Default C
            if (riskRating === "A") {
                riskFrequency = "Reduced Freq. once in 2yrs";
            } else if (riskRating === "B") {
                riskFrequency = "Moderate Freq. Once in a year";
            }
            data.risk_frequency = riskFrequency;

            // Map to User's Template Tags (from screenshot)
            data.risk_score_A = data.risk_tick_A;
            data.risk_score_B = data.risk_tick_B;
            data.risk_score_C = data.risk_tick_C;

            // Also map old aliases just in case, but encourage new ones
            data.risk_score_1 = data.risk_circle_1;
            data.risk_score_2 = data.risk_circle_2;
            data.risk_score_3 = data.risk_circle_3;

            // --- Aliases for Risk Categorization Template ---
            data.lead_inspectors = data.lead_inspector;
            data.co_inspectors = data.co_inspector;

            // Combine Trainees for the {trainee_inspectors} tag
            const trainees = [];
            if (data.trainee_inspector) trainees.push(data.trainee_inspector);
            if (data.trainee_inspector_2) trainees.push(data.trainee_inspector_2);
            data.trainee_inspectors = trainees.join(', '); // "Name 1, Name 2"

            // Also keep individual keys if needed
            data.trainee_inspector_1 = data.trainee_inspector;

            // data.licence_info is already correct from the form input name="licence_info"
            // data.superintendent_licence_info is already correct from input name="superintendent_licence_info"

            data.operations = data.operations_carried_out; // Now correctly mapped from form

            data.last_inspection_date = "N/A";

            data.timestamp = Timestamp.now();
            data.status = "Completed";

            // Calculate Risk (Simple Logic for now)
            let riskLevel = "Low";
            if (data.has_critical) riskLevel = "High";
            else if (data.has_major) riskLevel = "Medium";
            data.risk_level = riskLevel;

            console.log("Generating Report with Data:", data); // Debug log

            // 1. Generate Reports
            await generateReports(data);

            // 2. Save to Firestore (with Local Storage Fallback)
            try {
                if (state.editMode && state.editSource === 'firestore') {
                    // Update existing doc
                    await updateDoc(doc(db, "inspections", state.editId), data);
                    console.log("Updated Firestore Doc");
                    alert("Inspection Updated Successfully!");
                } else if (state.editMode && state.editSource === 'local') {
                    // Update local storage
                    const localData = JSON.parse(localStorage.getItem('inspections_local') || '[]');
                    const index = parseInt(state.editId.split('_')[1]);
                    if (!isNaN(index)) {
                        localData[index] = data;
                        localStorage.setItem('inspections_local', JSON.stringify(localData));
                        alert("Inspection Updated Locally!");
                    }
                } else {
                    // Create New
                    await addDoc(collection(db, "inspections"), data);
                    console.log("Saved to Firestore");
                }
            } catch (e) {
                console.warn("Firestore save/update failed (Offline/No DB), saving to Local Storage:", e);

                // Fallback: If update failed, or new save failed
                const localData = JSON.parse(localStorage.getItem('inspections_local') || '[]');

                if (state.editMode) {
                    // If we were trying to edit a firestore doc but failed, we can't easily "update" it offline 
                    // without complex sync. For now, let's save as a NEW local copy to prevent data loss.
                    localData.push(data);
                    alert("Note: Could not update online database. Saved as a NEW local copy instead.");
                } else {
                    localData.push(data);
                    alert("Note: Database not connected. Saved to Local Browser Storage instead.");
                }
                localStorage.setItem('inspections_local', JSON.stringify(localData));
            }

            // Reset Edit Mode
            state.editMode = false;
            state.editId = null;
            state.editSource = null;
            const submitBtn = document.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.innerHTML = '<span class="material-icons-round">description</span> Generate Reports & Save';

            // Update Dashboard
            loadDashboardStats();

            btn.disabled = false;
            btn.innerHTML = originalText;

            // Show success message
            // alert("Reports generated successfully! Check your downloads folder."); // Already alerted above for update

        } catch (error) {
            console.error("Error submitting form:", error);
            alert("Error: " + error.message);
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
        // Fix PizZip usage
        const PizZipConstructor = window.PizZip;
        if (!PizZipConstructor) throw new Error("PizZip library not loaded");

        const zip = new PizZipConstructor(content);
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
        // 1. GSDP Report
        { name: 'TEMPLATE.docx', out: `${data.facility_name} GSDP Report.docx` },

        // 2. Compliance Directive
        { name: 'TEMPLATE_1.docx', out: `${data.facility_name} Compliance Directive.docx` },

        // 3. CAPA
        { name: 'TEMPLATE_2.docx', out: `${data.facility_name} CAPA.docx` },

        // 4. Risk Categorization Worksheet
        { name: 'RISK_CATEGORIZATION TEMPLATE.docx', out: `${data.facility_name} Risk Categorization Worksheet.docx` }
    ];

    let errorMessages = [];
    for (const t of templates) {
        try {
            const content = await loadFile(t.name);
            renderTemplate(content, data, t.out);
        } catch (err) {
            console.warn(`Skipping ${t.name}: ${err.message}`);
            errorMessages.push(`${t.name}: ${err.message}`);
        }
    }

    if (errorMessages.length > 0) {
        alert(`Some reports failed to generate:\n\n${errorMessages.join('\n')}\n\nPlease check the Word templates for syntax errors (e.g. missing braces).`);
    }
}

// --- Dashboard Logic ---
async function loadDashboardStats() {
    try {
        let total = 0;
        let high = 0;
        let medium = 0;
        let low = 0;

        const processItem = (d) => {
            total++;
            // Robust check for High
            if (d.risk_rating === 'A' || d.risk_level === 'High') {
                high++;
            }
            // Robust check for Medium
            else if (d.risk_rating === 'B' || d.risk_level === 'Medium') {
                medium++;
            }
            // Default to Low
            else {
                low++;
            }
        };

        // 1. Try Firestore
        try {
            const querySnapshot = await getDocs(collection(db, "inspections"));
            querySnapshot.forEach((doc) => processItem(doc.data()));
        } catch (e) {
            console.log("Firestore stats failed, using local only");
        }

        // 2. Add Local Storage
        const localData = JSON.parse(localStorage.getItem('inspections_local') || '[]');
        localData.forEach(processItem);

        // Update UI
        const totalEl = document.getElementById('total-inspections');
        const highEl = document.getElementById('high-risk-count');
        const mediumEl = document.getElementById('medium-risk-count');
        const lowEl = document.getElementById('low-risk-count');

        if (totalEl) totalEl.textContent = total;
        if (highEl) highEl.textContent = high;
        if (mediumEl) mediumEl.textContent = medium;
        if (lowEl) lowEl.textContent = low;

    } catch (error) {
        console.log("Dashboard load error:", error);
    }
}

// --- Dashboard (History) ---
async function loadDashboardData() {
    const tbody = document.getElementById('dashboard-table-body');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading history...</td></tr>';

    try {
        let allItems = [];

        // 1. Get Firestore Data
        try {
            const q = query(collection(db, "inspections"), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => {
                const data = doc.data();
                data.id = doc.id; // Store ID for delete
                data.source = 'firestore';
                allItems.push(data);
            });
        } catch (dbError) {
            console.warn("Firestore access failed, using local data only.");
        }

        // 2. Get Local Storage Data
        const localData = JSON.parse(localStorage.getItem('inspections_local') || '[]');
        localData.forEach((item, index) => {
            item.id = index; // Use index as ID for local
            item.source = 'local';
            allItems.push(item);
        });

        // Sort
        allItems.sort((a, b) => {
            const tA = a.timestamp && a.timestamp.seconds ? a.timestamp.seconds : (a.timestamp instanceof Date ? a.timestamp.getTime() / 1000 : 0);
            const tB = b.timestamp && b.timestamp.seconds ? b.timestamp.seconds : (b.timestamp instanceof Date ? b.timestamp.getTime() / 1000 : 0);
            return tB - tA;
        });

        tbody.innerHTML = '';

        if (allItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No inspections found.</td></tr>';
            return;
        }

        allItems.forEach((item) => {
            const date = item.timestamp
                ? (item.timestamp.toDate ? item.timestamp.toDate().toLocaleDateString() : new Date(item.timestamp.seconds * 1000).toLocaleDateString())
                : (item.inspection_date || "N/A");
            const risk = item.risk_level || (item.risk_rating === 'A' ? 'High' : item.risk_rating === 'B' ? 'Medium' : 'Low');

            // Create unique ID for button actions
            const uniqueId = item.source === 'firestore' ? item.id : `local_${item.id}`;

            const row = `
                <tr>
                    <td>${item.facility_name}</td>
                    <td>${date}</td>
                    <td><span style="color: ${getRiskColor(risk)}; font-weight: 600;">${risk}</span></td>
                    <td>${item.status || 'Completed'}</td>
                    <td>
                        <button class="btn-outline" onclick="loadInspectionIntoForm('${uniqueId}', '${item.source}')" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; margin-right: 0.5rem;">Edit</button>
                        <button class="btn-outline" onclick="deleteInspection('${uniqueId}', '${item.source}')" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; color: red; border-color: red;">Delete</button>
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });

        // Update Stats
        document.querySelectorAll('.stat-card .value')[0].textContent = allItems.length;
        document.querySelectorAll('.stat-card .value')[1].textContent = allItems.filter(item => item.risk_level === 'High' || item.risk_rating === 'A').length;

    } catch (error) {
        console.error("Dashboard load error:", error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading data.</td></tr>';
    }
}

// Global Edit Function
window.loadInspectionIntoForm = async (id, source) => {
    try {
        let data;
        if (source === 'firestore') {
            // We need to fetch the single doc again or find it in our list
            // Fetching is safer
            // But we don't have getDoc imported. Let's find it in the list we just loaded?
            // Or just fetch all again? No, let's assume we can find it in the dashboard list if we stored it?
            // Better: Import getDoc. But for now, let's just use the data we have if we can access it.
            // Actually, we can just fetch it from the DB using getDocs and filtering, or add getDoc to imports.
            // Let's add getDoc to imports in next step if needed. 
            // For now, let's just re-query the collection and find it (inefficient but works without changing imports again yet).
            const q = query(collection(db, "inspections"));
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => {
                if (doc.id === id) data = doc.data();
            });
        } else {
            const localData = JSON.parse(localStorage.getItem('inspections_local') || '[]');
            const index = parseInt(id.split('_')[1]);
            data = localData[index];
        }

        if (!data) {
            alert("Could not load inspection data.");
            return;
        }

        // Populate Form
        // 1. Switch to New Inspection View
        document.querySelector('[data-view="new-inspection"]').click();

        // 2. Fill Inputs
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            if (data[input.name] !== undefined) {
                input.value = data[input.name];
            }
        });

        // 3. Handle Findings (Dynamic Rows)
        const findingsContainer = document.getElementById('findings-container');
        findingsContainer.innerHTML = ''; // Clear existing
        if (data.findings && Array.isArray(data.findings)) {
            data.findings.forEach(f => {
                addFindingRow(f);
            });
        }

        // 4. Handle Personnel (Dynamic Rows)
        const personnelContainer = document.getElementById('personnel-container');
        personnelContainer.innerHTML = '';
        if (data.personnel && Array.isArray(data.personnel)) {
            data.personnel.forEach(p => {
                addPersonnelRow(p);
            });
        }

        // 5. Set Edit Mode Flag
        state.editMode = true;
        state.editId = id;
        state.editSource = source;

        // Change Submit Button Text
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.innerHTML = '<span class="material-icons-round">save</span> Update Inspection';

        alert("Inspection loaded for editing.");

    } catch (error) {
        console.error("Edit load error:", error);
        alert("Error loading for edit: " + error.message);
    }
};

// Make delete function global
window.deleteInspection = async (id, source) => {
    if (!confirm("Are you sure you want to delete this inspection?")) return;

    try {
        if (source === 'firestore') {
            await deleteDoc(doc(db, "inspections", id));
        } else {
            // Local Storage Delete
            const localData = JSON.parse(localStorage.getItem('inspections_local') || '[]');
            // ID for local is "local_INDEX", so parse index
            const index = parseInt(id.split('_')[1]);
            if (!isNaN(index)) {
                localData.splice(index, 1);
                localStorage.setItem('inspections_local', JSON.stringify(localData));
            }
        }

        alert("Inspection deleted.");
        loadDashboardData(); // Refresh table
        loadDashboardStats(); // Refresh stats
    } catch (error) {
        console.error("Delete failed:", error);
        alert("Failed to delete: " + error.message);
    }
};

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
