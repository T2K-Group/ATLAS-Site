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
async function fetchDevicesWithAuth() {
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

  try {
    let url = "https://atlasapi.t2k.group/fetch/devices";
    if (delta_ts) url += `?timestamp=${encodeURIComponent(delta_ts)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    if (data?.data?.fetch_ts) localStorage.setItem("delta_ts", data.data.fetch_ts);

    // Save to IndexedDB
    await saveDevicesToDB(data);

    return data;

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
function renderDevices(devicesData) {
  const container = document.getElementById("devices-container");
  container.innerHTML = "";
  const { fetch_ts, ...orgs } = devicesData.data;

  const batteryIcons = {
    full: { icon: "fa-battery-full", color: "text-success" },
    high: { icon: "fa-battery-three-quarters", color: "text-success" },
    med: { icon: "fa-battery-half", color: "text-warning" },
    low: { icon: "fa-battery-quarter", color: "text-warning" },
    crit: { icon: "fa-battery-empty", color: "text-danger" }
  };

  for (const orgId in orgs) {
    const org = orgs[orgId];
    const orgTitle = document.createElement("h4");
    orgTitle.className = "mb-3 mt-4 fw-semibold";
    orgTitle.textContent = org.orgName || "Unknown Organisation";
    container.appendChild(orgTitle);

    if (!org.devices.length) continue;

    const table = document.createElement("table");
    table.className = "devices-table table table-hover align-middle";
    const sortState = { key: null, asc: true };

    table.innerHTML = `
      <thead class="table-light">
        <tr>
          <th class="sortable" data-key="name">Name <i class="fa-solid fa-sort"></i></th>
          <th class="sortable" data-key="battery">Battery <i class="fa-solid fa-sort"></i></th>
          <th class="sortable" data-key="lastSeen">Last Seen <i class="fa-solid fa-sort"></i></th>
          <th class="text-end"> </th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");

    function renderRows(devices) {
      tbody.innerHTML = "";
      const fragment = document.createDocumentFragment();
    
      devices.forEach(device => {
        // Main row
        const mainRow = document.createElement("tr");
        mainRow.className = "device-row";
        mainRow.style.cursor = "pointer";
        mainRow.innerHTML = `
          <td>${device.name || "Unnamed Device"}</td>
          <td>${device.battPercent != null ? device.battPercent + "%" : "—"}</td>
          <td>${device.lastSeen ? timeAgo(device.lastSeen) : "—"}</td>
          <td><button class="expand-btn btn btn-sm btn-outline-secondary"><i class="fa-solid fa-chart-line"></i></button></td>
        `;
        fragment.appendChild(mainRow);
    
        // Details row (lazy)
        const detailsRow = document.createElement("tr");
        detailsRow.className = "device-details";
        detailsRow.innerHTML = `<td colspan="4"><div class="details-content"></div></td>`;
        fragment.appendChild(detailsRow);
    
        const detailsContent = detailsRow.querySelector(".details-content");
    
        // Lazy load details on first click
        function toggleRow() {
          const isOpen = mainRow.classList.contains("open");
    
          // Close any other open rows
          document.querySelectorAll(".device-row.open").forEach(row => {
            row.classList.remove("open");
            row.nextElementSibling.classList.remove("open");
          });
    
          if (isOpen) return;
    
          mainRow.classList.add("open");
          detailsRow.classList.add("open");
    
          // Only populate details once
          if (!detailsContent.dataset.loaded) {
            const wrapper = document.createElement("div");
            wrapper.className = "details-wrapper";
    
            if (device.lat != null && device.lon != null) {
              const mapImg = document.createElement("img");
              mapImg.src = `https://maps.t2k.group?lat=${device.lat}&lon=${device.lon}&zoom=17&size=1000x600&radius=${device.acc}&shape=circle`;
              mapImg.className = "details-map";
              wrapper.appendChild(mapImg);
            }
    
            const infoContainer = document.createElement("div");
            infoContainer.className = "details-info";
    
            // Example: Location section
            const locationSection = document.createElement("div");
            locationSection.className = "detail-section";
            locationSection.innerHTML = `
              <div class="section-header"><i class="fa-solid fa-location-dot"></i> Location</div>
              <div class="section-body">
                <div class="detail-item"><i class="fa-solid fa-globe"></i> Latitude: ${device.lat ?? "—"}</div>
                <div class="detail-item"><i class="fa-solid fa-globe"></i> Longitude: ${device.lon ?? "—"}</div>
                <div class="detail-item"><i class="fa-solid fa-crosshairs"></i> Accuracy: ${device.acc ?? "—"}</div>
              </div>
            `;
            infoContainer.appendChild(locationSection);
    
            // Battery section (example)
            if (device.battVoltage || device.battTemp || device.battCurrentDraw) {
              const batterySection = document.createElement("div");
              batterySection.className = "detail-section";
              batterySection.innerHTML = `
                <div class="section-header"><i class="fa-solid fa-battery-full"></i> Battery</div>
                <div class="section-body">
                  ${device.battVoltage ? `<div class="detail-item"><i class="fa-solid fa-bolt"></i> Voltage: ${device.battVoltage} V</div>` : ""}
                  ${device.battTemp ? `<div class="detail-item"><i class="fa-solid fa-temperature-half"></i> Temp: ${device.battTemp} °C</div>` : ""}
                  ${device.battCurrentDraw ? `<div class="detail-item"><i class="fa-solid fa-gauge"></i> Current: ${device.battCurrentDraw} A</div>` : ""}
                </div>
              `;
              infoContainer.appendChild(batterySection);
            }
    
            wrapper.appendChild(infoContainer);
            detailsContent.appendChild(wrapper);
            detailsContent.dataset.loaded = "true";
          }
        }
    
        mainRow.addEventListener("click", toggleRow);
        mainRow.querySelector(".expand-btn").addEventListener("click", e => {
          e.stopPropagation();
          toggleRow();
        });
      });
    
      tbody.appendChild(fragment);
    }

    function sortDevices(key) {
      if (sortState.key === key) sortState.asc = !sortState.asc;
      else { sortState.key = key; sortState.asc = true; }

      const sorted = [...org.devices].sort((a, b) => {
        let valA, valB;
        switch (key) {
          case "name":
            valA = a.name?.toLowerCase() || "";
            valB = b.name?.toLowerCase() || "";
            return valA.localeCompare(valB) * (sortState.asc ? 1 : -1);
          case "battery":
            valA = a.battPercent ?? -1;
            valB = b.battPercent ?? -1;
            return (valA - valB) * (sortState.asc ? 1 : -1);
          case "lastSeen":
            valA = a.lastSeen ?? 0;
            valB = b.lastSeen ?? 0;
            return (valA - valB) * (sortState.asc ? 1 : -1);
          default: return 0;
        }
      });

      renderRows(sorted);
    }

    table.querySelectorAll("th.sortable").forEach(th => {
      th.style.cursor = "pointer";
      th.addEventListener("click", () => sortDevices(th.dataset.key));
    });

    renderRows(org.devices);
    container.appendChild(table);
  }
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
  const cached = await getDevicesFromDB();
  cachedDevicesData = cached; // cache it for searching
  renderDevices(cached);

  const fresh = await fetchDevicesWithAuth();
  if (fresh) {
    cachedDevicesData = await getDevicesFromDB(); // update cache
    renderDevices(cachedDevicesData);
  }

  startDeviceFetchPolling(); // keep fetching every 10s
}

// Run
init();