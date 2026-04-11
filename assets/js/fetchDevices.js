const lastDeviceState = {};
let map = null;
let mapMarker = null;
let locationModal = null;
let settingsModal = null;
let currentUserRole = 0;
let settingsCurrentDevice = null;


    function getCookie(name) {
      return document.cookie
        .split("; ")
        .find(row => row.startsWith(name + "="))
        ?.split("=")[1];
    }

async function checkAuth() {
    //console.info("check auth running");

    const sessionId = getCookie("session_id");
  
    if (!sessionId) {
      window.location.href = "/login.html";
      return;
    }
  
    try {
      const response = await fetch("https://atlasapi.t2k.group//whoami", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${sessionId}`,
          "Content-Type": "application/json"
        }
      });
  
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
  
      const result = await response.json();
  
      // Invalid token
      if (!result.status) {
        window.location.href = "/login.html";
        return;
      }
  
      const user = result.data;
      console.log("Authenticated user:", user);
  
      // Account not activated
      if (user.role === 0) {
        document.body.innerHTML = `
          <div style="
            max-width: 420px;
            margin: 10vh auto;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            font-family: sans-serif;
            text-align: center;
          ">
            ${user.orglogo ? `
              <img src="${user.orglogo}"
                   alt="${user.orgname}"
                   style="max-width: 200px; margin-bottom: 16px;">
            ` : ""}
            <h2>Account Not Activated</h2>
            <p><strong>${user.name}</strong></p>
            <p>${user.orgname}</p>
            <p style="margin-top: 16px;">
              Your account has not been activated.<br>
              Please contact your organisation’s admin or
              <a href="mailto:atlas@t2k.group">atlas@t2k.group</a>.
            </p>
          </div>
        `;
        return;
      }
  
      // Logged in and active → show org logo
      const orgImg = document.getElementById("org-img");
      if (orgImg && user.orglogo) {
        orgImg.src = user.orglogo;
        orgImg.removeAttribute("hidden");
      }

      // if role = 1 set anything with class user-hide to hidden
      //if role = 2 set anything with class la-hide to hidden

    if (user.role !== 1) {
      document.querySelectorAll(".user-hide").forEach(el => {
        el.hidden = false;
      });
    }

    if (user.role > 2) {
      document.querySelectorAll(".la-hide").forEach(el => {
        el.hidden = false;
      });
    }
  
      // Optional: make user globally available
      window.currentUser = user;
  
    } catch (err) {
      console.error("Auth check failed:", err);
      window.location.href = "/login.html";
    }
  };
  

function formatLocationType(type) {
  const map = {
    0: "GPS",
    1: "WiFi",
    2: "Multi-cell",
    3: "Single-cell",
    4: "Hybrid (WiFi + Cell)"
  };

  return map[type] ?? "Unknown";
}

function formatOperationType(type) {
  const map = {
    0: "Sleep",
    1: "Active",
    2: "Alert",
  };

  return map[type] ?? "Unknown";
}

function formatTrackType(type) {
  const map = {
    0: "WiFi First",
    1: "GPS First",
    2: "Mapping",
  };

  return map[type] ?? "Unknown";
}





function getCookie(name) {
  return document.cookie
    .split("; ")
    .find(row => row.startsWith(name + "="))
    ?.split("=")[1];
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("DevicesDB", 4);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      // Drop and recreate stores to clear stale cached data
      ["orgs", "sites", "devices"].forEach(name => {
        if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
      });

      db.createObjectStore("orgs", { keyPath: "orgId" });

      const siteStore = db.createObjectStore("sites", { keyPath: "id" });
      siteStore.createIndex("orgId", "orgId", { unique: false });

      const deviceStore = db.createObjectStore("devices", { keyPath: "deviceId" });
      deviceStore.createIndex("orgId", "orgId", { unique: false });
      deviceStore.createIndex("siteId", "siteId", { unique: false, multiEntry: true });
      deviceStore.createIndex("name", "name", { unique: false }); // if you still search by name
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
  if (!timestamp) return "-";

  const seconds = Math.floor((Date.now() - new Date(timestamp)) / 1000);

  if (seconds < 60)
    return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)
    return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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

    // -------------------------
    // ORG CARD
    // -------------------------
    let orgCard = container.querySelector(`#org-${orgId}`);
    if (!orgCard) {
      orgCard = document.createElement("div");
      orgCard.id = `org-${orgId}`;
      orgCard.className = "card shadow-sm mb-4";

      orgCard.innerHTML = `
        <div class="card-header bg-primary text-white fw-bold">
          ${org.orgName}
        </div>
        <div class="card-body"></div>
      `;

      container.appendChild(orgCard);
    }

    const orgBody = orgCard.querySelector(".card-body");

    // -------------------------
    // SITES
    // -------------------------
    for (const siteId in org.sites) {
      const site = org.sites[siteId];
      const isPseudo = site.id === "_unassigned";

      if (!isPseudo && !(site.active === 1 && site.checkin === 1)) continue;

      let siteSection = orgBody.querySelector(`#site-${siteId}`);

      if (!siteSection) {
        siteSection = document.createElement("div");
        siteSection.id = `site-${siteId}`;
        siteSection.className = "mb-4";

        siteSection.innerHTML = `
          <h5 class="mb-2 fw-semibold">
            ${isPseudo ? "Not in a Site" : site.name}
          </h5>
          <div class="table-responsive">
            <table class="table table-sm table-hover table-striped align-middle">
              <thead class="table-light">
                <tr class="device-table">
                  <th>Device</th>
                  <th class="la-hide" hidden>IMEI</th>
                  <th>Location</th>
                  <th>Battery</th>
                  <th>Last Seen</th>
                  <th class="la-hide" hidden>Settings</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        `;

        orgBody.appendChild(siteSection);
      }

      const tbody = siteSection.querySelector("tbody");
      const activeRows = new Set();

      site.devices.sort((a, b) => {
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      });

      site.devices.forEach(dev => {
        const key = `${dev.deviceId}`;
        activeRows.add(dev.name);

        let row = tbody.querySelector(`tr[data-device="${dev.name}"]`);

        if (!row) {
          row = document.createElement("tr");
          row.dataset.device = dev.name;

          row.innerHTML = `
            <td class="dev-name"></td>
            <td class="dev-imei la-hide" hidden></td>
            <td class="dev-location"></td>
            <td class="dev-batt"></td>
            <td class="dev-lastseen"></td>
            <td class="dev-settings la-hide" hidden></td>
          `;

          tbody.appendChild(row);
        }

        const prev = lastDeviceState[key];

        // Only update static data if changed
        if (
          !prev ||
          prev.battPercent !== dev.battPercent ||
          prev.lastSeen !== dev.lastSeen
        ) {

          let connected;

          const svgClass = dev.connected == 1 ? 'text-success' : 'text-danger';
          connected = `<svg class="${svgClass}" style="width:1em;height:1em;fill:currentColor;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM320 224C373 224 416 267 416 320C416 373 373 416 320 416C267 416 224 373 224 320C224 267 267 224 320 224z"/></svg>`;

          const isConnectionPresent = dev.connected
          if (typeof isConnectionPresent === "number"){
          row.querySelector(".dev-name").innerHTML = `${connected} <span>${dev.name}</span>`;
          } else {
           row.querySelector(".dev-name").innerHTML = `<span>${dev.name}</span>` 
          }
        
          const imei = dev.imei;

          if (typeof imei === "string" && imei.length >= 5) {
            row.querySelector(".dev-imei").textContent = imei.slice(-5);
          } else {
            row.querySelector(".dev-imei").textContent = "N/A";
          }

          const battCell = row.querySelector(".dev-batt");

          if (dev.battPercent == "full") {
            battCell.innerHTML = `
              <i class="fa-solid fa-battery-full text-success" title="Full"></i>
            `;
          }
          else if (dev.battPercent == "high") {
            battCell.innerHTML = `
              <i class="fa-solid fa-battery-three-quarters text-success" title="High"></i>
            `;
          }
          else if (dev.battPercent == "med") {
            battCell.innerHTML = `
              <i class="fa-solid fa-battery-half text-warning" title="Medium"></i>
            `;
          }
          else if (dev.battPercent == "low") {
            battCell.innerHTML = `
              <i class="fa-solid fa-battery-quarter text-warning" title="Low"></i>
            `;
          }
          else if (dev.battPercent == "crit") {
            battCell.innerHTML = `
              <i class="fa-solid fa-battery-empty text-danger" title="Critical"></i>
            `;
          }
          else {
            battCell.textContent = dev.battPercent + "%";
          }

          const locCell = row.querySelector(".dev-location");
          locCell.innerHTML = `
            <button class="btn btn-sm btn-outline-primary view-location">
              View
            </button>
          `;

          const settingsCell = row.querySelector(".dev-settings");
          settingsCell.innerHTML = `
          <button class="btn btn-sm btn-outline-primary view-location">
          <i class="fa-solid fa-gear"></i>
            </button>
          `

          locCell.querySelector("button").onclick = () => {
            openDeviceMap(dev);
          };

          settingsCell.querySelector("button").onclick = () => {
            openDeviceSettings(lastDeviceState[key]);
          };
        }


  

        // Always store state
        lastDeviceState[key] = dev;

        // Always update last seen text
        row.querySelector(".dev-lastseen").textContent =
          timeAgo(dev.lastSeen);
      });

      // Remove stale rows
      Array.from(tbody.querySelectorAll("tr")).forEach(tr => {
        if (!activeRows.has(tr.dataset.device)) {
          tbody.removeChild(tr);
        }
      });
    }
  }

  applyDeviceSearch();
  checkAuth()
}

function applyDeviceSearch() {
  const query = (document.getElementById("device-search")?.value || "").toLowerCase().trim();

  document.querySelectorAll("#device-container tr[data-device]").forEach(row => {
    const match = !query || row.dataset.device.toLowerCase().includes(query);
    row.style.display = match ? "" : "none";
  });

  // Hide site sections with no visible rows
  document.querySelectorAll("#device-container [id^='site-']").forEach(section => {
    const hasVisible = Array.from(section.querySelectorAll("tbody tr")).some(r => r.style.display !== "none");
    section.style.display = hasVisible ? "" : "none";
  });

  // Hide org cards with no visible site sections
  document.querySelectorAll("#device-container [id^='org-']").forEach(card => {
    const hasVisible = Array.from(card.querySelectorAll("[id^='site-']")).some(s => s.style.display !== "none");
    card.style.display = hasVisible ? "" : "none";
  });
}

function updateLastSeenTimes() {
  document.querySelectorAll("tr[data-device]").forEach(row => {
    const deviceName = row.dataset.device;

    const key = Object.keys(lastDeviceState).find(k =>
      k.endsWith("_" + deviceName)
    );

    if (!key) return;

    const dev = lastDeviceState[key];
    const cell = row.querySelector(".dev-lastseen");

    if (!cell) return;

    const newText = timeAgo(dev.lastSeen);

    if (cell.textContent !== newText) {
      cell.textContent = newText;
    }
  });
}


function openDeviceMap(dev) {
  const modalElement = document.getElementById("locationModal");

  if (!locationModal) {
    locationModal = new bootstrap.Modal(modalElement);
  }

  locationModal.show();

  // Wait for modal animation to finish
  setTimeout(() => {
    if (!map) {
      map = L.map("map").setView([dev.lat, dev.lon], 15);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
      }).addTo(map);
    }

    map.setView([dev.lat, dev.lon], 15);

    if (mapMarker) {
      map.removeLayer(mapMarker);
    }

    mapMarker = L.marker([dev.lat, dev.lon])
      .addTo(map)
      .bindPopup(`<strong>${dev.name}</strong>`)
      .openPopup();

    // Fix rendering issue when inside modal
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

  }, 300);
}

// Safe getter for numbers or parsed values
function getValue(val) {
  if (val == null) return "N/A";
  if (typeof val === "object") return val.parsedValue ?? "N/A";
  return val;
}

// Convert timestamp to readable date
function formatTimestamp(ts) {
  if (!ts) return "N/A";
  const date = new Date(Number(ts));
  return date.toLocaleString();
}


async function getSitesByOrg(orgId) {
  const db = await openDB();
  const tx = db.transaction("sites", "readonly");
  const index = tx.objectStore("sites").index("orgId");
  return new Promise((resolve, reject) => {
    const req = index.getAll(String(orgId));
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function populateMgmtOrgs(selectedOrgId) {
  const db = await openDB();
  const tx = db.transaction("orgs", "readonly");
  const orgs = await new Promise((res, rej) => {
    const req = tx.objectStore("orgs").getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });

  const orgSelect = document.getElementById("mgmt-org");
  orgSelect.innerHTML = '<option value="">-- Select Org --</option>';
  orgs.forEach(org => {
    const opt = document.createElement("option");
    opt.value = org.orgId;
    opt.textContent = org.orgName;
    if (String(org.orgId) === String(selectedOrgId)) opt.selected = true;
    orgSelect.appendChild(opt);
  });
}

async function populateMgmtSites(orgId, selectedSiteId) {
  const siteSelect = document.getElementById("mgmt-site");

  if (!orgId) {
    siteSelect.innerHTML = '<option value="">-- Select Org First --</option>';
    siteSelect.disabled = true;
    return;
  }

  const sites = await getSitesByOrg(orgId);
  siteSelect.innerHTML = '<option value="0">-- No Site --</option>';
  sites.forEach(site => {
    const opt = document.createElement("option");
    opt.value = site.id;
    opt.textContent = site.name;
    if (String(site.id) === String(selectedSiteId)) opt.selected = true;
    siteSelect.appendChild(opt);
  });
  siteSelect.disabled = false;
}

async function openDeviceSettings(dev) {
  const el = document.getElementById("settingsModal");
  if (!settingsModal) settingsModal = new bootstrap.Modal(el);

  settingsCurrentDevice = dev;

  // Device name
  document.getElementById("deviceName").textContent = dev.name;

  // Battery Info
  const battPercent = getValue(dev.battPercent);
  const battColor = battPercent < 20 ? "text-danger fw-bold" : "";
  document.getElementById("battPercent").innerHTML = `Battery: <span class="${battColor}">${battPercent}%</span>`;
  document.getElementById("battVoltage").textContent = `Voltage: ${getValue(dev.battVoltage)} V`;
  document.getElementById("battTemp").textContent = `Temperature: ${getValue(dev.battTemp)} °C`;
  document.getElementById("battCurrentDraw").textContent = `Current Draw: ${getValue(dev.battCurrentDraw)} A`;
  document.getElementById("battTTE").textContent = `Time to Empty: ${timeTo(dev.battTTE)}`;

  // Cell Info
  document.getElementById("mmc").textContent = `MCC: ${dev.mmc ?? "N/A"}`;
  document.getElementById("mnc").textContent = `MNC: ${dev.mnc ?? "N/A"}`;
  document.getElementById("tac").textContent = `TAC: ${dev.tac ?? "N/A"}`;
  document.getElementById("band").textContent = `Band: ${dev.band ?? "N/A"}`;
  document.getElementById("cellId").textContent = `Cell ID: ${dev.cellId ?? "N/A"}`;
  document.getElementById("imei").textContent = `IMEI: ${dev.imei ?? "N/A"}`;
  document.getElementById("iccid").textContent = `ICCID: ${dev.iccid ?? "N/A"}`;
  document.getElementById("imsi").textContent = `IMSI: ${dev.imsi ?? "N/A"}`;

  //Device Info
  document.getElementById("fwv").textContent = `Firmware Version: ${dev.fwv ?? "N/A"}`;
  document.getElementById("mfw").textContent = `Modem FW Version: ${dev.mfw ?? "N/A"}`;
  document.getElementById("branch").textContent = `Branch: ${dev.branch ?? "N/A"}`;
  document.getElementById("build").textContent = `Build: ${dev.build ?? "N/A"}`;
  document.getElementById("buildDate").textContent = `Build Date: ${dev.buildDate ?? "N/A"}`;

  //Device Settings
  document.getElementById("opMode").textContent = `Operation Mode: ${formatOperationType(dev.operationMode) ?? "N/A"}`;
  document.getElementById("trackMode").textContent = `Tracking Mode: ${formatTrackType(dev.trackingMode) ?? "N/A"}`;
  document.getElementById("trackInt").textContent = `Tracking Interval: ${dev.TrackIntervalSec ?? "N/A"} secs`;
  document.getElementById("statusInt").textContent = `Status Interval: ${dev.statusIntervalMins ?? "N/A"} mins`;
  document.getElementById("sleepInt").textContent = `Sleep Interval: ${dev.deepSleepIntervalMins ?? "N/A"} mins`;
  document.getElementById("sleepConnTry").textContent = `Sleep Connection Try: ${dev.sleepConnTry ?? "N/A"} mins`;
  document.getElementById("sleepConnInt").textContent = `Sleep Connection Timer: ${dev.sleepConnTimerMins ?? "N/A"} mins`;



  // Location Info
  document.getElementById("lat").textContent = `Latitude: ${getValue(dev.lat)}`;
  document.getElementById("lon").textContent = `Longitude: ${getValue(dev.lon)}`;
  document.getElementById("accuracy").textContent = `Accuracy: ${getValue(dev.acc)} meters`;
  document.getElementById("loctype").textContent = `Location Type: ${formatLocationType(dev.locationType)}`; // 0 = gps, 1 = wifi, 2 = multicell, 3 = singlecell
  document.getElementById("atSite").textContent = `At Site: ${dev.atSite && dev.atSite.length ? dev.atSite.join(", ") : "No"}`;
  document.getElementById("lastLoc").textContent = `Last Location: ${formatTimestamp(dev.lastLocation)}`;
  document.getElementById("lastSeen").textContent = `Last Seen: ${formatTimestamp(dev.lastSeen)}`;

  // Device Management section (role >= 2 only)
  const mgmtSection = document.getElementById("deviceMgmtSection");
  if (currentUserRole >= 2) {
    mgmtSection.hidden = false;
    document.getElementById("mgmt-name").value = dev.name || "";
    document.getElementById("mgmt-status").textContent = "";

    await populateMgmtOrgs(dev.orgId);
    await populateMgmtSites(dev.orgId, dev.siteId);

    // Re-wire org change → update sites dropdown
    const orgSelect = document.getElementById("mgmt-org");
    orgSelect.onchange = () => populateMgmtSites(orgSelect.value, null);
  } else {
    mgmtSection.hidden = true;
  }

  settingsModal.show();
}

document.getElementById("mgmt-save").addEventListener("click", async () => {
  console.log("saving")
  const dev = settingsCurrentDevice;
  if (!dev || !dev.deviceId) return;

  const token = getCookie("session_id");
  const statusEl = document.getElementById("mgmt-status");

  const name = document.getElementById("mgmt-name").value.trim() || null;
  const orgId = document.getElementById("mgmt-org").value;
  const siteId = document.getElementById("mgmt-site").value;

  const body = {};
  if (name !== null) body.name = name;
  if (orgId !== "") body.org_id = parseInt(orgId);
  if (siteId !== "") body.site_id = parseInt(siteId);

  statusEl.textContent = "Saving...";
  statusEl.className = "ms-2 small text-muted";

  try {
    const res = await fetch(`https://atlasapi.t2k.group/update/device/${dev.deviceId}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (data.status) {
      statusEl.textContent = "Saved";
      statusEl.className = "ms-2 small text-success";
      await fetchAndSaveAtlasData(true);
      // Clear container and state so moved devices don't linger in old org/site
      document.getElementById("device-container").innerHTML = "";
      Object.keys(lastDeviceState).forEach(k => delete lastDeviceState[k]);
      await renderDevicesTable();
    } else {
      statusEl.textContent = data.message || "Failed";
      statusEl.className = "ms-2 small text-danger";
    }
  } catch (err) {
    statusEl.textContent = "Error";
    statusEl.className = "ms-2 small text-danger";
    console.error(err);
  }
});

async function clearDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase("DevicesDB");
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => console.warn("DB delete blocked");
  });
}

async function init(){

  await clearDatabase();
  localStorage.removeItem("delta_ts");

  document.getElementById("device-search")?.addEventListener("input", applyDeviceSearch);

  
  await renderDevicesTable();
  await fetchAndSaveAtlasData(true);

  // Fetch user role for admin features
  const token = getCookie("session_id");
  if (token) {
    try {
      const res = await fetch("https://atlasapi.t2k.group/whoami", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.status) currentUserRole = data.data.role ?? 0;
    } catch (e) {
      console.warn("Could not fetch user role", e);
    }
  }

  await renderDevicesTable();
  startDevicePolling();
  // Update every second
  setInterval(updateLastSeenTimes, 1000);
}

init()