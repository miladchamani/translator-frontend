// ===== SUBTITLE TRANSLATOR FRONT-END LOGIC - v5.2 =====

// ❗️❗️❗️ مهم: این آدرس را به آدرس Worker خود تغییر دهید ❗️❗️❗️
const API_BASE_URL = 'https://subtitle-translator.milad-ch-1981.workers.dev'; // مثال: https://my-worker.example.com

// --- State Management ---
let currentFile = null;
let originalBlocks = [];
let translatedBlocks = [];
let currentSettings = { level: 3, tone: 1, artistic: false };

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
        e.preventDefault();
        e.stopPropagation();
        if (eventName === "dragover") {
            uploadArea.classList.add("dragover");
        } else {
            uploadArea.classList.remove("dragover");
        }
        if (eventName === "drop" && e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });
});

fileInput.addEventListener("change", e => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

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
    if (!file.name.match(/\.(srt|txt)$/i)) {
        alert("لطفاً فقط فایل‌های SRT یا TXT آپلود کنید.");
        return;
    }
    currentFile = file;
    const reader = new FileReader();
    reader.onload = e => {
        parseSubtitleFile(e.target.result);
        accessPassword.disabled = false;
        accessPassword.placeholder = "پسورد را وارد کنید";
        validatePassword();
        uploadArea.innerHTML = `<span class='upload-icon'>✅</span><div class='upload-text'>فایل آپلود شد: ${currentFile.name}</div><div class='upload-subtext'>${originalBlocks.length} خط دیالوگ شناسایی شد</div>`;
    };
    reader.readAsText(file);
}

function parseSubtitleFile(content) {
    originalBlocks = [];
    const isSrt = content.includes("-->");
    const chunks = content.trim().replace(/\r\n/g, "\n").split(/\n\s*\n/);

    for (const chunk of chunks) {
        const lines = chunk.split("\n").map(l => l.trim()).filter(Boolean);
        if (lines.length < (isSrt ? 2 : 1)) continue;

        try {
            let num, timing, textLines;
            if (isSrt) {
                if (!lines[0].match(/^\d+$/) || !lines[1].includes("-->")) continue;
                num = parseInt(lines[0]);
                timing = lines[1];
                textLines = lines.slice(2);
            } else {
                num = originalBlocks.length + 1;
                timing = null;
                textLines = [lines.join(" ")];
            }

            if (textLines.length > 1) {
                textLines.forEach((line, index) => {
                    originalBlocks.push({
                        id: `[#${String(num).padStart(3, "0")}-${index + 1}]`,
                        text: line.replace(/<[^>]+>/g, "").trim(),
                        timing: timing,
                        blockNum: num
                    });
                });
            } else if (textLines.length === 1) {
                originalBlocks.push({
                    id: `[#${String(num).padStart(3, "0")}]`,
                    text: textLines[0].replace(/<[^>]+>/g, "").trim(),
                    timing: timing,
                    blockNum: num
                });
            }
        } catch (error) {
            console.error("Error parsing block:", chunk, error);
        }
    }
    displayOriginalContent();
}

function displayOriginalContent() {
    document.getElementById("empty-state-wrapper").style.display = "none";
    let html = "";
    originalBlocks.forEach(block => {
        html += `
<div class="block-wrapper" id="wrapper-${block.id}">
<div class="subtitle-block translated">
<div class="block-header">
<div class="block-id">${block.id}</div>
${block.timing ? `<div class="block-timing">${block.timing}</div>` : ""}
</div>
<div class="block-content translated" style="color: var(--text-secondary);">منتظر شروع ترجمه ...</div>
</div>
<div class="subtitle-block original">
<div class="block-header">
<div class="block-id">${block.id}</div>
${block.timing ? `<div class="block-timing">${block.timing}</div>` : ""}
</div>
<div class="block-content original">${block.text}</div>
</div>
</div>
`;
    });
    contentGrid.innerHTML = html;
}

function displayTranslatedContent() {
    translatedBlocks.forEach(block => {
        const wrapper = document.getElementById(`wrapper-${block.id}`);
        if (wrapper) {
            wrapper.querySelector(".block-content.translated").innerHTML = block.text;
            wrapper.querySelector(".block-content.translated").style.color = "var(--text-primary)";
        }
    });
}

function updateProgress(message) {
    progressText.textContent = message;
}

async function validatePassword() {
    const password = accessPassword.value.trim();
    const canTranslate = currentFile && originalBlocks.length > 0;
    
    translateBtn.disabled = true;
    passwordError.style.display = "none";
    accessPassword.style.borderColor = "var(--border-color)";

    if (!password) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/validate-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: password }),
        });
        const data = await response.json();
        if (data.valid) {
            accessPassword.style.borderColor = "var(--success)";
            if (canTranslate) {
                translateBtn.disabled = false;
            }
        } else {
            passwordError.style.display = "block";
            accessPassword.style.borderColor = "#ef4444";
        }
    } catch (error) {
        passwordError.textContent = "خطا در ارتباط با سرور";
        passwordError.style.display = "block";
    }
}

async function startTranslation() {
    if (!currentFile || originalBlocks.length === 0) return;
    if (!API_BASE_URL) {
        alert("خطا: آدرس API در فایل script.js تنظیم نشده است!");
        return;
    }

    progressContainer.style.display = "block";
    translateBtn.disabled = true;
    downloadSection.style.display = "none";
    let isHolistic = originalBlocks.length > 20 && currentSettings.level === 3;

    try {
        updateProgress(isHolistic ? "مرحله ۱ از ۲: در حال تحلیل زمینه کلی..." : "در حال آماده‌سازی برای ترجمه...");
        const response = await fetch(`${API_BASE_URL}/api/translate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                blocks: originalBlocks,
                settings: currentSettings,
                password: accessPassword.value.trim()
            })
        });

        if (isHolistic) {
            updateProgress("مرحله ۲ از ۲: در حال ترجمه تکه‌ها...");
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            translatedBlocks = result.translatedBlocks;
            displayTranslatedContent();
            updateProgress("ترجمه با موفقیت تکمیل شد!");
            setTimeout(() => {
                progressContainer.style.display = "none";
                downloadSection.style.display = "block";
            }, 1500);
        } else {
            progressContainer.style.display = "none";
            updateProgress("خطا در ترجمه!");
            alert(result.error || "An unknown server error occurred.");
        }
    } catch (error) {
        console.error("Translation process error:", error);
        progressContainer.style.display = "none";
        updateProgress("خطای جدی!");
        alert("Translation Error: " + error.message);
    }
}

function downloadResult() {
    if (!translatedBlocks.length) return;

    const srtBlocks = {};
    translatedBlocks.forEach(translatedBlock => {
        const original = originalBlocks.find(b => b.id === translatedBlock.id);
        if (!original || !original.timing) return;
        const blockNum = original.blockNum;
        if (!srtBlocks[blockNum]) {
            srtBlocks[blockNum] = { timing: original.timing, lines: [] };
        }
        srtBlocks[blockNum].lines.push(translatedBlock.originalTranslation);
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