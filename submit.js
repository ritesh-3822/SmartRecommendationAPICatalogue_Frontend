const API_BASE = "http://localhost:8080"; // Spring Boot backend base

const form = document.getElementById("submitForm");
const nameEl = document.getElementById("apiName");
const descEl = document.getElementById("apiDesc");
const dupBtn = document.getElementById("dupCheckBtn");
const submitBtn = document.getElementById("submitApiBtn");
const statusEl = document.getElementById("submitStatus");

function setStatus(msg, kind = "") {
  // IMPORTANT: Using innerHTML to correctly render the list items (ul/li)
  statusEl.innerHTML = msg || ""; 
  statusEl.className = "status " + (kind || "");
}

/* --------------------------
   1️⃣ Check for similar APIs
-------------------------- */
async function checkDuplicates(name, description) {
  const res = await fetch(`${API_BASE}/api/check-duplicates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiName: name, description })
  });
  if (!res.ok) throw new Error("Duplicate check failed");
  // Expected: { message, similarApis: [...] }
  return res.json();
}

/* --------------------------
   3️⃣ Handle "Check Duplicates" button (MODIFIED)
-------------------------- */
dupBtn.addEventListener("click", async () => {
  const name = nameEl.value.trim();
  const description = descEl.value.trim();

  if (!description) {
    setStatus("Please enter a description to check for duplicates.", "err");
    return;
  }

  setStatus("Checking for similar APIs…");
  dupBtn.disabled = true;
  submitBtn.disabled = true;

  try {
    const data = await checkDuplicates(name, description);
    if (data.similarApis && data.similarApis.length > 0) {
      // Display similar APIs and allow submission immediately
      const list = data.similarApis
        .map(api => `<li><strong>${api.apiName}</strong> — ${api.description}</li>`)
        .join("");
      setStatus(
        `⚠️ Similar APIs found:<ul>${list}</ul><p>Review the list, then click **Submit API** if you want to add it anyway.</p>`,
        "warn"
      );

      // Re-enable the main Submit button for "Add Anyway" action
      submitBtn.disabled = false;
      
      // Removed: document.getElementById("confirmAddBtn").addEventListener(...)
    } else {
      setStatus("✅ No similar APIs found. You can submit now.", "ok");
      submitBtn.disabled = false;
    }
  } catch (e) {
    console.error("Duplicate check failed", e);
    setStatus("Couldn’t check for duplicates. Try again.", "err");
  } finally {
    dupBtn.disabled = false;
  }
});

/* --------------------------
   4️⃣ Handle Form Submission
-------------------------- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  await handleSubmit();
});

/* --------------------------
   Add new API - Core function
-------------------------- */
async function submitApi(name, description) {
  const res = await fetch(`${API_BASE}/api/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiName: name, description })
  });

  if (!res.ok) throw new Error("Submit failed");
  return res.json(); // Expect: { message: "API saved Successfully!" }
}

/* --------------------------
   Handle Submit flow
-------------------------- */
async function handleSubmit() {
  const name = nameEl.value.trim();
  const description = descEl.value.trim();

  if (!name || !description) {
    setStatus("Please fill in both API name and description.", "err");
    return;
  }

  setStatus("Submitting new API...");
  submitBtn.disabled = true;
  dupBtn.disabled = true;

  try {
    const data = await submitApi(name, description);
    setStatus(`${data.message} 🎉 Redirecting...`, "ok");

    // Redirect to chat or main page
    setTimeout(() => (window.location.href = "./index.html"), 1000);
  } catch (err) {
    console.error("Submit failed:", err);
    setStatus("Failed to submit API. Please try again.", "err");
  } finally {
    submitBtn.disabled = false;
    dupBtn.disabled = false;
  }
}