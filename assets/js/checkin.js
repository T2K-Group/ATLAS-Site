let orgData = {};
let currentDevices = [];



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

function startCheckin() {
  const orgId = document.getElementById("orgSelect").value;

  if (!orgId) {
    alert("Select an organisation");
    return;
  }

  currentDevices = [];

  const org = orgData[orgId];
  if (org && org.sites) {
    Object.values(org.sites).forEach(site => {
      currentDevices.push(...site.devices);
    });
  }

  renderDevices();
}

async function loadOrgs() {
  const response = await getDevicesByOrgAndSite();

  orgData = response;

  const orgSelect = document.getElementById("orgSelect");
  orgSelect.innerHTML = '<option value="">Select Organisation</option>';

  Object.entries(orgData).forEach(([orgId, org]) => {
    const option = document.createElement("option");
    option.value = orgId;
    option.textContent = org.orgName;
    orgSelect.appendChild(option);
  });
}

function checkInDevice(button) {
  button.classList.add("checked");
}

function renderDevices() {
  const grid = document.getElementById("deviceGrid");
  grid.innerHTML = "";

  currentDevices.forEach(device => {
    const btn = document.createElement("button");
    btn.className = "device-btn";
    btn.innerText = device.name;
    btn.dataset.device = device.name;
    btn.onclick = () => checkInDevice(btn);
    grid.appendChild(btn);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("startBtn").onclick = startCheckin;
  loadOrgs();
});
