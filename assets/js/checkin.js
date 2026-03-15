let orgData = {};
let currentDevices = [];

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
