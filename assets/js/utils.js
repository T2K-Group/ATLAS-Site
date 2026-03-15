'use strict';

// -------------------------
// Cookie helper
// -------------------------
function getCookie(name) {
  return document.cookie
    .split("; ")
    .find(row => row.startsWith(name + "="))
    ?.split("=")[1];
}

// -------------------------
// IndexedDB helper
// -------------------------
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("DevicesDB", 2);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("orgs")) {
        db.createObjectStore("orgs", { keyPath: "orgId" });
      }

      if (!db.objectStoreNames.contains("sites")) {
        const siteStore = db.createObjectStore("sites", { keyPath: "id" });
        siteStore.createIndex("orgId", "orgId", { unique: false });
      }

      if (!db.objectStoreNames.contains("devices")) {
        const deviceStore = db.createObjectStore("devices", { keyPath: "name" });
        deviceStore.createIndex("orgId", "orgId", { unique: false });
        deviceStore.createIndex("siteId", "siteId", { unique: false, multiEntry: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// -------------------------
// Toast notifications
// -------------------------
function showToast(message, type = "success", duration = 3000) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toastEl = document.createElement("div");
  toastEl.id = `toast-${Date.now()}`;
  toastEl.className = `toast align-items-center text-bg-${type} border-0`;
  toastEl.setAttribute("role", "alert");
  toastEl.setAttribute("aria-live", "assertive");
  toastEl.setAttribute("aria-atomic", "true");

  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;

  container.appendChild(toastEl);

  const toast = new bootstrap.Toast(toastEl, { delay: duration });
  toast.show();

  toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
}
