const deviceGrid = document.getElementById("device-grid");
let devices = [];
let orgData = {};
let currentDevices = [];

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("DevicesDB", 2); // bumped version

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


function startCheckin() {
  const orgId = document.getElementById("orgSelect").value;

  if (!orgId) {
    alert("Select an organisation");
    return;
  }

  // Collect all devices from all sites for this org
  currentDevices = [];

  const org = orgData[orgId];
  if (org && org.sites) {
    Object.values(org.sites).forEach(site => {
      currentDevices.push(...site.devices);
    });
  }

  console.log("Starting check-in for org:", orgId, "with devices:", currentDevices);

  renderDevices();

}

async function getDevicesByOrgAndSite() {
  const db = await openDB();
  const tx = db.transaction(["orgs", "sites", "devices"], "readonly");

  const orgs = await new Promise((res, rej) => {
    const request = tx.objectStore("orgs").getAll();
    request.onsuccess = () => res(request.result || []);
    request.onerror = () => rej(request.error);
  });

  const sites = await new Promise((res, rej) => {
    const request = tx.objectStore("sites").getAll();
    request.onsuccess = () => res(request.result || []);
    request.onerror = () => rej(request.error);
  });

  const devices = await new Promise((res, rej) => {
    const request = tx.objectStore("devices").getAll();
    request.onsuccess = () => res(request.result || []);
    request.onerror = () => rej(request.error);
  });

  // --- Structure ---
  const result = {};

  orgs.forEach(org => {
    result[org.orgId] = {
      orgName: org.orgName,
      sites: {}
    };
  });

  // Map sites to org
  sites.forEach(site => {
    if (!result[site.orgId]) return;
    result[site.orgId].sites[site.id] = { ...site, devices: [] };
  });

  // Assign devices to sites if atSite includes the site id, else unassigned
  devices.forEach(device => {
    const org = result[device.orgId];
    if (!org) return;

    if (device.atSite && device.atSite.length > 0) {
      device.atSite.forEach(siteId => {
        if (org.sites[siteId]) {
          org.sites[siteId].devices.push(device);
        }
      });
    } else {
      // Device not in any site → put in "unassigned" pseudo-site
      if (!org.sites["_unassigned"]) org.sites["_unassigned"] = { id: "_unassigned", name: "Unassigned", devices: [] };
      org.sites["_unassigned"].devices.push(device);
    }
  });

  return result;
}

async function loadOrgs() {

    console.log("Loading orgs...")

  const response = await getDevicesByOrgAndSite();

  console.log("Fetched org data:", response);

  orgData = response;

  console.log("Loaded org data:", orgData);

  const orgSelect = document.getElementById("orgSelect");

  orgSelect.innerHTML = '<option value="">Select Organisation</option>';

  Object.entries(orgData).forEach(([orgId, org]) => {

    const option = document.createElement("option");
    option.value = orgId;
    option.textContent = org.orgName;

    orgSelect.appendChild(option);

  });

}


function loadDevices(org) {

    // Replace with API call later
    devices = [
        { name: "Tracker 1", checked: false },
        { name: "Tracker 2", checked: false },
        { name: "Tracker 3", checked: false },
        { name: "Tracker 4", checked: false },
        { name: "Tracker 5", checked: false }
    ];

    renderDevices();
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

async function fetchSitesWithAuth() {
    // Helper to read cookies
    function getCookie(name) {
        return document.cookie
            .split("; ")
            .find(row => row.startsWith(name + "="))
            ?.split("=")[1];
    }

    const token = getCookie("session_id");

    if (!token) {
        console.error("No session_id cookie found");
        return;
    }

    try {
        const response = await fetch("https://atlasapi.t2k.group/fetch/sites", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data;

    } catch (err) {
        console.error("Error fetching sites:", err);
    }
}


// This simulates a device check-in
function deviceCheckedIn(name) {

    const device = devices.find(d => d.name === name);
    if (!device) return;

    device.checked = true;

    renderDevices();
}

document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM loaded, initializing check-in page...");
    document.getElementById("startBtn").onclick = startCheckin;
  loadOrgs();
});

