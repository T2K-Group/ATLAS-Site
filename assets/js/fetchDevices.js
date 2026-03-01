const lastDeviceState = {};


// -------------------------
// IndexedDB Helper
// -------------------------
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

async function saveApiDataToDB(apiData) {
  const db = await openDB();
  const tx = db.transaction(["orgs", "sites", "devices"], "readwrite");

  const orgStore = tx.objectStore("orgs");
  const siteStore = tx.objectStore("sites");
  const deviceStore = tx.objectStore("devices");

  // --- Save Orgs ---
  for (const orgId in apiData.devices.data) {
    if (orgId === "fetch_ts") continue;
    const org = apiData.devices.data[orgId];
    orgStore.put({ orgId, orgName: org.orgName });

    // --- Save Devices ---
    for (const device of org.devices) {
      deviceStore.put({ ...device, orgId });
    }
  }

  // --- Save Sites ---
  for (const orgId in apiData.sites.data) {
    const orgSites = apiData.sites.data[orgId];
    for (const site of orgSites.sites) {
      siteStore.put({ ...site, orgId });
    }
  }

  return tx.complete;
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
async function fetchAndSaveAtlasData(forceFull = false) {
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
  if (!delta_ts || forceFull) delta_ts = 0;

  try {
    // --- Fetch Devices ---
    let deviceUrl = "https://atlasapi.t2k.group/fetch/devices";
    if (delta_ts) deviceUrl += `?timestamp=${encodeURIComponent(delta_ts)}`;

    const [deviceRes, siteRes] = await Promise.all([
      fetch(deviceUrl, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }),
      fetch("https://atlasapi.t2k.group/fetch/sites", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      })
    ]);

    if (!deviceRes.ok) throw new Error(`Devices HTTP ${deviceRes.status}`);
    if (!siteRes.ok) throw new Error(`Sites HTTP ${siteRes.status}`);

    const devicesData = await deviceRes.json();
    const sitesData = await siteRes.json();

    // --- Save fetch timestamp ---
    if (devicesData?.data?.fetch_ts) {
      localStorage.setItem("delta_ts", devicesData.data.fetch_ts);
    }

    // --- Save to IndexedDB ---
    await saveApiDataToDB({ devices: devicesData, sites: sitesData });

    return { devices: devicesData, sites: sitesData };

  } catch (err) {
    console.error("Error fetching Atlas data:", err);
  }
}

let devicePollingInterval = null;

function startDevicePolling() {
  // Immediately fetch once, then every 5 seconds
  fetchAndUpdateDevices();
  devicePollingInterval = setInterval(fetchAndUpdateDevices, 5000);
}

async function fetchAndUpdateDevices() {
  function getCookie(name) {
    return document.cookie
      .split("; ")
      .find(row => row.startsWith(name + "="))
      ?.split("=")[1];
  }

  const token = getCookie("session_id");
  if (!token) return;

  let delta_ts = localStorage.getItem("delta_ts") || 0;

  try {
    let deviceUrl = "https://atlasapi.t2k.group/fetch/devices";
    if (delta_ts) deviceUrl += `?timestamp=${encodeURIComponent(delta_ts)}`;

    const response = await fetch(deviceUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const devicesData = await response.json();

    // Update delta timestamp
    if (devicesData?.data?.fetch_ts) {
      localStorage.setItem("delta_ts", devicesData.data.fetch_ts);
    }

    // Save only devices to DB
    await saveApiDataToDB({ devices: devicesData, sites: { data: {} } });

    // Render updated data in DOM
    renderDevicesTable();

  } catch (err) {
    console.error("Error fetching devices:", err);
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

async function renderDevicesTable() {
  const container = document.getElementById("device-container");
  if (!container) return;

  const data = await getDevicesByOrgAndSite();

  for (const orgId in data) {
    const org = data[orgId];

    // Org card
    let orgCard = container.querySelector(`#org-${orgId}`);
    if (!orgCard) {
      orgCard = document.createElement("div");
      orgCard.id = `org-${orgId}`;
      orgCard.className = "card mb-3";

      const orgHeader = document.createElement("div");
      orgHeader.className = "card-header bg-primary text-white";
      orgHeader.textContent = org.orgName;
      orgCard.appendChild(orgHeader);

      const orgBody = document.createElement("div");
      orgBody.className = "card-body";
      orgCard.appendChild(orgBody);

      container.appendChild(orgCard);
    }

    const orgBody = orgCard.querySelector(".card-body");

    // Track sites rendered
    const sitesToRender = {};

    for (const siteId in org.sites) {
      const site = org.sites[siteId];

      // Only render if active + checkin OR if pseudo site (_unassigned)
      const isPseudo = site.id === "_unassigned";
      if (!isPseudo && !(site.active === 1 && site.checkin === 1)) continue;

      sitesToRender[siteId] = site;

      let siteSection = orgBody.querySelector(`#site-${siteId}`);
      if (!siteSection) {
        siteSection = document.createElement("div");
        siteSection.id = `site-${siteId}`;

        const siteTitle = document.createElement("h5");
        siteTitle.textContent = isPseudo ? "Not in a Site" : site.name;
        siteSection.appendChild(siteTitle);

        const table = document.createElement("table");
        table.className = "table table-sm table-bordered table-hover";
        table.innerHTML = `
          <thead>
            <tr>
              <th>Device</th>
              <th>Lat</th>
              <th>Lon</th>
              <th>Battery %</th>
              <th>Last Seen</th>
            </tr>
          </thead>
          <tbody></tbody>
        `;
        siteSection.appendChild(table);
        orgBody.appendChild(siteSection);
      }

      const tbody = siteSection.querySelector("tbody");
      const renderedRows = {};

      site.devices.forEach(dev => {
        const key = `${orgId}_${siteId}_${dev.name}`;
        renderedRows[key] = true;

        const prev = lastDeviceState[key];

        // Skip if unchanged
        if (
          prev &&
          prev.lat === dev.lat &&
          prev.lon === dev.lon &&
          prev.battPercent === dev.battPercent &&
          prev.lastSeen === dev.lastSeen
        ) return;

        lastDeviceState[key] = { ...dev };

        let row = tbody.querySelector(`tr[data-device="${dev.name}"]`);
        if (!row) {
          row = document.createElement("tr");
          row.setAttribute("data-device", dev.name);
          tbody.appendChild(row);
        }

        row.innerHTML = `
          <td>${dev.name}</td>
          <td>${dev.lat.toFixed(5)}</td>
          <td>${dev.lon.toFixed(5)}</td>
          <td>${dev.battPercent}%</td>
          <td>${timeAgo(dev.lastSeen)}</td>
        `;
      });

      // Remove rows no longer present
      Array.from(tbody.querySelectorAll("tr")).forEach(tr => {
        const key = `${orgId}_${siteId}_${tr.dataset.device}`;
        if (!renderedRows[key]) {
          tbody.removeChild(tr);
          delete lastDeviceState[key];
        }
      });
    }

    // --- Handle devices not in any site ---
    if (!org.sites["_unassigned"]) {
      const unassignedDevices = [];
      Object.values(org.sites).forEach(site => {
        if (site.id !== "_unassigned") {
          site.devices.forEach(dev => {
            if (!dev.atSite || dev.atSite.length === 0) {
              unassignedDevices.push(dev);
            }
          });
        }
      });

      if (unassignedDevices.length > 0) {
        if (!org.sites["_unassigned"]) {
          org.sites["_unassigned"] = { id: "_unassigned", name: "Not in a Site", devices: [] };
        }
        org.sites["_unassigned"].devices = unassignedDevices;
        // Render pseudo-site
        sitesToRender["_unassigned"] = org.sites["_unassigned"];
      }
    }
  }
}

async function init(){
  await renderDevicesTable()
  await fetchAndSaveAtlasData(true)
  await renderDevicesTable()
  startDevicePolling();
}

init()