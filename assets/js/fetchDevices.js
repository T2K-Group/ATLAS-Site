let cachedSitesData = null;
const orgContainers = new Map(); // orgId -> container div
const siteTables = new Map(); // orgId -> siteId -> table element
const deviceRowMap = new Map(); // deviceName -> { mainRow, detailsRow }

const sortStates = new Map(); // tableElement -> { key, asc }
// -------------------------
// IndexedDB Helper
// -------------------------
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("DevicesDB", 1);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("orgs")) {
        db.createObjectStore("orgs", { keyPath: "orgId" });
      }

      if (!db.objectStoreNames.contains("devices")) {
        const deviceStore = db.createObjectStore("devices", { keyPath: "name" });
        deviceStore.createIndex("orgId", "orgId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// -------------------------
// Save API data to IndexedDB
// -------------------------
async function saveDevicesToDB(apiData) {
  const db = await openDB();
  const tx = db.transaction(["orgs", "devices"], "readwrite");
  const orgStore = tx.objectStore("orgs");
  const deviceStore = tx.objectStore("devices");

  for (const orgId in apiData.data) {
    if (orgId === "fetch_ts") continue;
    const org = apiData.data[orgId];

    // Save org
    orgStore.put({ orgId, orgName: org.orgName });

    // Save/update devices
    for (const device of org.devices) {
      deviceStore.put({ ...device, orgId });
    }
  }

  return tx.complete;
}

// -------------------------
// Load devices from IndexedDB
// -------------------------
async function getDevicesFromDB() {
  const db = await openDB();
  const tx = db.transaction(["orgs", "devices"], "readonly");
  const orgStore = tx.objectStore("orgs");
  const deviceStore = tx.objectStore("devices");

  // Wrap getAll in promises
  const orgsArray = await new Promise((resolve, reject) => {
    const request = orgStore.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });

  const devices = await new Promise((resolve, reject) => {
    const request = deviceStore.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });

  // Convert orgs array to object keyed by orgId
  const orgsObj = {};
  orgsArray.forEach(org => {
    orgsObj[org.orgId] = {
      orgName: org.orgName,
      devices: devices.filter(d => d.orgId === org.orgId)
    };
  });

  return { data: orgsObj };
}
// -------------------------
// Fetch Devices API
// -------------------------
async function fetchDevicesWithAuth(forceFull = false) {
  function getCookie(name) {
    return document.cookie
      .split("; ")
      .find(row => row.startsWith(name + "="))
      ?.split("=")[1];
  }

  const token = getCookie("session_id");
  if (!token) {
    console.error("No session_id cookie found!");
    return;
  }

  let delta_ts = localStorage.getItem("delta_ts");

  // First load OR manual force
  if (!delta_ts || forceFull) {
    delta_ts = 0;
  }

  try {
    let url = "https://atlasapi.t2k.group/fetch/devices";
    if (delta_ts) {
      url += `?timestamp=${encodeURIComponent(delta_ts)}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();

    // Save new fetch timestamp
    if (data?.data?.fetch_ts) {
      localStorage.setItem("delta_ts", data.data.fetch_ts);
    }

    await saveDevicesToDB(data);

    return data;

  } catch (err) {
    console.error("Error fetching devices:", err);
  }
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

// -------------------------
// Utility Functions
// -------------------------
function timeAgo(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const seconds = Math.floor((now - past) / 1000);
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

function timeTo(timestamp) {
  const now = new Date();
  const future = new Date(timestamp);
  const seconds = Math.floor((future - now) / 1000);

  if (seconds <= 0) return "now";

  if (seconds < 60) return `in ${seconds} second${seconds !== 1 ? "s" : ""}`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `in ${minutes} minute${minutes !== 1 ? "s" : ""}`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours} hour${hours !== 1 ? "s" : ""}`;
  
  const days = Math.floor(hours / 24);
  return `in ${days} day${days !== 1 ? "s" : ""}`;
}

function formatTimeToEmpty(tte) {
  if (!tte) return null;
  const date = new Date(tte);
  if (isNaN(date)) return tte;
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const dayName = date.toLocaleDateString("en-GB", { weekday: "short" });
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${hours}:${minutes} ${dayName} ${day}/${month}/${year}`;
}

// -------------------------
// Render Devices Table
// -------------------------
async function renderDevices(devicesData) {
  const container = document.getElementById("devices-container");

  // Remove orgs that no longer exist
  const existingOrgIds = new Set(Object.keys(devicesData.data));
  for (const [orgId, orgDiv] of orgContainers) {
    if (!existingOrgIds.has(orgId)) {
      orgDiv.remove();
      orgContainers.delete(orgId);
      siteTables.delete(orgId);
    }
  }

  for (const orgId in devicesData.data) {
    const org = devicesData.data[orgId];

    // Org container
    let orgDiv = orgContainers.get(orgId);
    if (!orgDiv) {
      orgDiv = document.createElement("div");
      container.appendChild(orgDiv);
      orgContainers.set(orgId, orgDiv);
    }

    let header = orgDiv.querySelector("h4");
    if (!header) {
      header = document.createElement("h4");
      header.className = "mb-3 mt-4 fw-semibold";
      orgDiv.appendChild(header);
    }
    header.textContent = org.orgName || "Unknown Organisation";
    // Group devices by site
    const orgSites = cachedSitesData?.data?.[orgId]?.sites || [];
    const currentSiteMap = {};
    orgSites.forEach(site => {
      if (site.checkin === 1 && site.active === 1) currentSiteMap[site.id] = site.name;
    });

    const devicesBySite = {};
    const unassignedDevices = [];

    org.devices.forEach(device => {
      if (device.atSite && device.atSite.length) {
        device.atSite.forEach(siteId => {
          if (!currentSiteMap[siteId]) return;
          if (!devicesBySite[siteId]) devicesBySite[siteId] = [];
          devicesBySite[siteId].push(device);
        });
      } else {
        unassignedDevices.push(device);
      }
    });

    // Combine sites and unassigned
    const allSites = { ...devicesBySite };
    if (unassignedDevices.length) allSites["unassigned"] = unassignedDevices;
    if (!siteTables.has(orgId)) siteTables.set(orgId, new Map());

    const orgSiteTables = siteTables.get(orgId);

    // -------------------------
    // Create / update tables
    // -------------------------
    for (const siteId in allSites) {
      const siteName = siteId === "unassigned" ? "Not at a Site" : currentSiteMap[siteId] || `Site ${siteId}`;
      const devices = allSites[siteId];

      let table = orgSiteTables.get(siteId);
      if (!table) {
        // Create new table
        const siteHeader = document.createElement("h6");
        siteHeader.className = "mt-3 fw-semibold text-primary";
        siteHeader.textContent = `${siteName} (${devices.length})`;
        orgDiv.appendChild(siteHeader);

        table = document.createElement("table");
        table.className = "devices-table table table-hover align-middle";
        table.innerHTML = `
          <thead class="table-light">
            <tr>
              <th class="sortable" data-key="name">Name <i class="fa-solid fa-sort"></i></th>
              <th class="sortable" data-key="battery">Battery <i class="fa-solid fa-sort"></i></th>
              <th class="sortable" data-key="lastSeen">Last Seen <i class="fa-solid fa-sort"></i></th>
              <th class="text-end"></th>
            </tr>
          </thead>
          <tbody></tbody>
        `;
        orgDiv.appendChild(table);

        // Sorting
        sortStates.set(table, { key: null, asc: true });
        table.querySelectorAll("th.sortable").forEach(th => {
          th.style.cursor = "pointer";
          th.addEventListener("click", () => {
            sortDevicesTable(table, th.dataset.key);
          });
        });

        orgSiteTables.set(siteId, table);
      } else {
        // Update header count
        const header = table.previousElementSibling;
        if (header) header.textContent = `${siteName} (${devices.length})`;
      }

      updateTableRows(table, devices);
    }
  }
}

// -------------------------
function updateTableRows(table, devices) {
  const tbody = table.querySelector("tbody");

  // Track devices currently in table
  const existingRows = new Map();
  tbody.querySelectorAll("tr.device-row").forEach(row => {
    existingRows.set(row.dataset.deviceName, row);
  });

  const incomingDeviceNames = new Set();

  devices.forEach(device => {
    const deviceName = device.name;
    incomingDeviceNames.add(deviceName);

    let mainRow = existingRows.get(deviceName);
    let detailsRow;

    if (!mainRow) {
      // 🆕 NEW DEVICE — create rows
      mainRow = document.createElement("tr");
      mainRow.className = "device-row";
      mainRow.dataset.deviceName = deviceName;
      mainRow.style.cursor = "pointer";

      detailsRow = document.createElement("tr");
      detailsRow.className = "device-details";
      detailsRow.style.display = "none";
      detailsRow.innerHTML = `<td colspan="4"><div class="details-content"></div></td>`;

      tbody.appendChild(mainRow);
      tbody.appendChild(detailsRow);

      mainRow.addEventListener("click", () =>
        toggleDetails(mainRow, detailsRow, device)
      );
    } else {
      // Existing device
      detailsRow = mainRow.nextElementSibling;
    }

    const newHTML = `
      <td>${device.name || "Unnamed Device"}</td>
      <td>${device.battPercent != null ? device.battPercent + "%" : "—"}</td>
      <td>${device.lastSeen ? timeAgo(device.lastSeen) : "—"}</td>
      <td>
        <button class="expand-btn btn btn-sm btn-outline-secondary">
          <i class="fa-solid fa-chart-line"></i>
        </button>
      </td>
    `;

    if (mainRow.innerHTML !== newHTML) {
      const isExpanded = detailsRow.style.display !== "none";

      mainRow.innerHTML = newHTML;

      mainRow.querySelector(".expand-btn").addEventListener("click", e => {
        e.stopPropagation();
        toggleDetails(mainRow, detailsRow, device);
      });

      // Preserve expanded state
      if (isExpanded) {
        detailsRow.style.display = "";
      }
    }
  });


  existingRows.forEach((row, deviceName) => {
    if (!incomingDeviceNames.has(deviceName)) {
      const detailsRow = row.nextElementSibling;
      row.remove();
      if (detailsRow) detailsRow.remove();
    }
  });
}


function sortDevicesTable(table, key) {
  const state = sortStates.get(table);
  if (state.key === key) state.asc = !state.asc;
  else {
    state.key = key;
    state.asc = true;
  }

  const tbody = table.querySelector("tbody");

  const mainRows = Array.from(
    tbody.querySelectorAll("tr.device-row")
  );

  const sorted = mainRows.sort((a, b) => {
    const nameA = a.cells[0].textContent.toLowerCase();
    const nameB = b.cells[0].textContent.toLowerCase();
    const batteryA = parseInt(a.cells[1].textContent) || -1;
    const batteryB = parseInt(b.cells[1].textContent) || -1;
    const lastSeenA = a.cells[2].textContent;
    const lastSeenB = b.cells[2].textContent;

    switch (key) {
      case "name":
        return nameA.localeCompare(nameB) * (state.asc ? 1 : -1);
      case "battery":
        return (batteryA - batteryB) * (state.asc ? 1 : -1);
      case "lastSeen":
        return lastSeenA.localeCompare(lastSeenB) * (state.asc ? 1 : -1);
      default:
        return 0;
    }
  });

  const fragment = document.createDocumentFragment();

  sorted.forEach(mainRow => {
    const detailsRow = tbody.querySelector(
      `tr.device-details`
    );

    // Instead of nextElementSibling, use this:
    const next = mainRow.nextElementSibling;
    const isDetails =
      next && next.classList.contains("device-details");

    fragment.appendChild(mainRow);
    if (isDetails) fragment.appendChild(next);
  });

  tbody.appendChild(fragment);
}

// -------------------------
// Filter Function
// -------------------------
function filterDevices(query) {
  const q = query.toLowerCase();
  deviceRowMap.forEach(({ mainRow, detailsRow }, name) => {
    const show = name.toLowerCase().includes(q);
    mainRow.style.display = show ? "" : "none";
    detailsRow.style.display = show ? "" : "none";
  });
}

// -------------------------
// Poll devices from API every 10 seconds
// -------------------------
function startDeviceFetchPolling() {
  async function poll() {
    try {
      const freshData = await fetchDevicesWithAuth(); // your existing API fetch
      if (freshData) {
        console.log("Devices fetched at", new Date().toLocaleTimeString());
        // IndexedDB update is already handled inside fetchDevicesWithAuth
      }
    } catch (err) {
      console.error("Error fetching devices:", err);
    }
  }

  // Initial fetch immediately
  poll();

  // Then repeat every 10 seconds
  const intervalId = setInterval(poll, 10000);

  return intervalId; // in case you want to stop polling later
}

const searchInput = document.getElementById("device-search");

let cachedDevicesData = null; // store the full device list

searchInput.addEventListener("input", () => {
  if (!cachedDevicesData) return;

  const query = searchInput.value.toLowerCase();

  // Filter each org's devices
  const filteredData = { data: {} };
  for (const orgId in cachedDevicesData.data) {
    const org = cachedDevicesData.data[orgId];
    const filteredDevices = org.devices.filter(device =>
      device.name?.toLowerCase().includes(query)
    );

    filteredData.data[orgId] = {
      orgName: org.orgName,
      devices: filteredDevices
    };
  }

  renderDevices(filteredData);
});

// -------------------------
// Init Function
// -------------------------
async function init() {
  // Load cached data first (fast UI paint)
  const cached = await getDevicesFromDB();
  cachedDevicesData = cached;
  renderDevices(cached);

  const [freshDevices, freshSites] = await Promise.all([
    fetchDevicesWithAuth(true),  
    fetchSitesWithAuth()
  ]);

  if (freshDevices) {
    cachedDevicesData = await getDevicesFromDB();
  }

  if (freshSites) {
    cachedSitesData = freshSites;
  }

  renderDevices(cachedDevicesData);

  startDeviceFetchPolling();
}

// Run
init();