// ===== SUBTITLE TRANSLATOR FRONT-END LOGIC - v6.0 FINAL (Sub-ID Protocol) =====

// ❗️❗️❗️ مهم: این آدرس را با آدرس Worker خودتان جایگزین کنید ❗️❗️❗️
const API_BASE_URL = 'https://subtitle-translator.milad-ch-1981.workers.dev'; 

// --- State Management ---
let currentFile = null;
let originalLines = [];
let translatedLines = [];
let currentSettings = { level: 3, tone: 2, artistic: false };

// --- DOM Element Selection ---
const uploadArea = document.getElementById("uploadArea");
const fileInput = document.getElementById("fileInput");
const translateBtn = document.getElementById("translateBtn");
const progressContainer = document.getElementById("progressContainer");
const progressText = document.getElementById("progressText");
const contentGrid = document.getElementById("contentGrid");
const downloadSection = document.getElementById("downloadSection");
const downloadBtn = document.getElementById("downloadBtn");
const artisticMode = document.getElementById("artisticMode");
const accessPassword = document.getElementById("accessPassword");
const passwordError = document.getElementById("passwordError");

// --- Event Listeners ---
uploadArea.addEventListener("click", () => fileInput.click());
["dragover", "dragleave", "drop"].forEach(eventName => {
    uploadArea.addEventListener(eventName, e => {
        e.preventDefault(); e.stopPropagation();
        uploadArea.classList.toggle("dragover", eventName === "dragover");
        if (eventName === "drop" && e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
});
fileInput.addEventListener("change", e => e.target.files.length && handleFile(e.target.files[0]));
document.querySelectorAll(".setting-options").forEach(group => {
    group.addEventListener("click", e => {
        const button = e.target.closest(".option-btn");
        if (button) {
            group.querySelectorAll(".option-btn").forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");
            currentSettings[group.dataset.type] = parseInt(button.dataset.value);
        }
    });
});
artisticMode.addEventListener("change", e => currentSettings.artistic = e.target.checked);
translateBtn.addEventListener("click", startTranslation);
downloadBtn.addEventListener("click", downloadResult);
let passwordTimeout = null;
accessPassword.addEventListener("input", () => {
    clearTimeout(passwordTimeout);
    passwordTimeout = setTimeout(validatePassword, 300);
});

// --- Core Functions ---
function handleFile(file) {
    if (!file.name.match(/\.(srt|txt)$/i)) { alert("Please upload only SRT or TXT files."); return; }
    currentFile = file;
    const reader = new FileReader();
    reader.onload = e => {
        parseSubtitleFile(e.target.result);
        accessPassword.disabled = false;
        accessPassword.placeholder = "Enter access code";
        validatePassword();
        uploadArea.innerHTML = `<span class='upload-icon'>✅</span><div class='upload-text'>File Uploaded: ${currentFile.name}</div><div class='upload-subtext'>${originalLines.length} dialogue lines identified</div>`;
    };
    reader.readAsText(file);
}

function parseSubtitleFile(content) {
    originalLines = [];
    const isSrt = content.includes("-->");
    const chunks = content.trim().replace(/\r\n/g, "\n").split(/\n\s*\n/);

    for (const chunk of chunks) {
        const lines = chunk.split("\n").map(l => l.trim().replace(/<[^>]+>/g, "")).filter(Boolean);
        if (lines.length < (isSrt ? 2 : 1)) continue;

        try {
            let num, timing, textLines;
            if (isSrt) {
                if (!lines[0].match(/^\d+$/) || !lines[1].includes("-->")) continue;
                num = parseInt(lines[0]);
                timing = lines[1];
                textLines = lines.slice(2);
            } else {
                num = originalLines.length + 1;
                timing = null;
                textLines = [lines.join(" ")];
            }

            if (textLines.length > 1 && isSrt) { // Multi-line block in SRT -> Create Sub-IDs
                textLines.forEach((line, index) => {
                    originalLines.push({
                        id: `[#${String(num).padStart(3, "0")}-${index + 1}]`,
                        text: line.trim(),
                        timing: timing,
                        blockNum: num
                    });
                });
            } else { // Single-line block or TXT line
                originalLines.push({
                    id: `[#${String(num).padStart(3, "0")}]`,
                    text: textLines.join(" ").trim(),
                    timing: timing,
                    blockNum: num
                });
            }
        } catch (error) { console.error("Error parsing chunk:", chunk, error); }
    }
    displayOriginalContent();
}

function displayOriginalContent() {
    document.getElementById("empty-state-wrapper").style.display = "none";
    let html = "";
    originalLines.forEach(line => {
        html += `
        <div class="block-wrapper" id="wrapper-${line.id}">
            <div class="subtitle-block translated"><div class="block-header"><div class="block-id">${line.id}</div>${line.timing ? `<div class="block-timing">${line.timing}</div>` : ""}</div><div class="block-content translated" style="color: var(--text-secondary);">Awaiting translation...</div></div>
            <div class="subtitle-block original"><div class="block-header"><div class="block-id">${line.id}</div>${line.timing ? `<div class="block-timing">${line.timing}</div>` : ""}</div><div class="block-content original">${line.text}</div></div>
        </div>`;
    });
    contentGrid.innerHTML = html;
}

function displayTranslatedContent() {
    translatedLines.forEach(line => {
        const wrapper = document.getElementById(`wrapper-${line.id}`);
        if (wrapper) {
            const el = wrapper.querySelector(".block-content.translated");
            el.innerHTML = line.text;
            el.style.color = "var(--text-primary)";
        }
    });
}

function updateProgress(message) { progressText.textContent = message; }

async function validatePassword() {
    const password = accessPassword.value.trim();
    translateBtn.disabled = true;
    passwordError.style.display = "none";
    accessPassword.style.borderColor = "var(--border-color)";
    if (!password) return;
    try {
        const response = await fetch(`${API_BASE_URL}/api/validate-password`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: password }),
        });
        const data = await response.json();
        if (data.valid) {
            accessPassword.style.borderColor = "var(--success)";
            if (currentFile && originalLines.length > 0) translateBtn.disabled = false;
        } else {
            passwordError.style.display = "block";
            accessPassword.style.borderColor = "#ef4444";
        }
    } catch (error) {
        passwordError.textContent = "Server communication error";
        passwordError.style.display = "block";
    }
}

async function startTranslation() {
    if (!currentFile || originalLines.length === 0) return;
    // CORRECTED 'if' CONDITION
	   if (!API_BASE_URL || API_BASE_URL === 'YOUR_WORKER_URL') {
		alert("Error: API_BASE_URL is not set in script.js! Please replace the placeholder with your actual worker URL.");
		return;
	  }
    progressContainer.style.display = "block";
    translateBtn.disabled = true;
    downloadSection.style.display = "none";
    updateProgress("Translating in chunks...");
    try {
        const response = await fetch(`${API_BASE_URL}/api/translate`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ blocks: originalLines, settings: currentSettings, password: accessPassword.value.trim() })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        const result = await response.json();
        if (result.success) {
            translatedLines = result.translatedBlocks;
            displayTranslatedContent();
            updateProgress("Translation completed successfully!");
            setTimeout(() => {
                progressContainer.style.display = "none";
                downloadSection.style.display = "block";
            }, 1500);
        } else {
            throw new Error(result.error || "An unknown server error occurred.");
        }
    } catch (error) {
        console.error("Translation process error:", error);
        progressContainer.style.display = "none";
        updateProgress("Critical Error!");
        alert("Translation Error: " + error.message);
    }
}

function downloadResult() {
    if (!translatedLines.length) return;
    const srtBlocks = {};
    translatedLines.forEach(line => {
        if (!line.timing) return;
        const blockNum = line.blockNum;
        if (!srtBlocks[blockNum]) {
            srtBlocks[blockNum] = { timing: line.timing, lines: [] };
        }
        srtBlocks[blockNum].lines.push(line.originalTranslation);
    });

    let srtContent = "";
    Object.keys(srtBlocks).map(Number).sort((a, b) => a - b).forEach(num => {
        const block = srtBlocks[num];
        srtContent += `${num}\n${block.timing}\n${block.lines.join("\n")}\n\n`;
    });

    const blob = new Blob(["\uFEFF" + srtContent.trim()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `translated_${currentFile.name}`;
    a.click();
    URL.revokeObjectURL(url);
}