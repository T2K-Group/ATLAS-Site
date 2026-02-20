async function fetchDevicesWithAuth() {
    // Helper to read cookies
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
  
    try {

      const response = await fetch("https://atlasapi.t2k.group/fetch/devices", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
      return data
  
    } catch (err) {
      console.error("Error fetching devices:", err);
    }
  }
  
  
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


function renderDevices(devicesData) {
  const container = document.getElementById("devices-container");
  container.innerHTML = "";

  const orgs = devicesData.data;

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

    // Keep a reference to sort state
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
      devices.forEach(device => {
        const mainRow = document.createElement("tr");
        mainRow.className = "device-row";
        mainRow.style.cursor = "pointer";

        let batteryDisplay = "—";
        if (device.battPercent != null) {
          if (typeof device.battPercent === "number") {
            batteryDisplay = `<strong>${device.battPercent}%</strong>`;
          } else {
            const icon = batteryIcons[device.battPercent.toLowerCase()] || batteryIcons.crit;
            batteryDisplay = `<i class="fa-solid ${icon.icon} ${icon.color}"></i>`;
          }
        }

        mainRow.innerHTML = `
          <td class="fw-medium">${device.name || "Unnamed Device"}</td>
          <td>${batteryDisplay}</td>
          <td>${device.lastSeen ? timeAgo(device.lastSeen) : "—"}</td>
          <td class="text-end">
            <button 
              class="expand-btn btn btn-sm btn-outline-secondary"
              title="Details"
              aria-label="Details">
              <i class="fa-solid fa-chart-line"></i>
            </button>
          </td>
        `;

        const detailsRow = document.createElement("tr");
        detailsRow.className = "device-details";
        detailsRow.innerHTML = `
          <td colspan="4">
            <div class="details-content"></div>
          </td>
        `;

        const detailsContent = detailsRow.querySelector(".details-content");

        function toggleRow() {
          const isOpen = mainRow.classList.contains("open");

          document.querySelectorAll(".device-row.open").forEach(row => {
            row.classList.remove("open");
            row.nextElementSibling.classList.remove("open");
          });

          if (isOpen) return;

          mainRow.classList.add("open");
          detailsRow.classList.add("open");

          if (!detailsContent.dataset.loaded) {
            const wrapper = document.createElement("div");
            wrapper.className = "details-wrapper";

            if (device.lat && device.lon) {
              const mapImg = document.createElement("img");
              mapImg.src = `https://maps.t2k.group?lat=${device.lat}&lon=${device.lon}&zoom=17&size=1000x600&radius=${device.acc}&shape=circle`;
              mapImg.className = "details-map";
              wrapper.appendChild(mapImg);
            }

            const infoContainer = document.createElement("div");
            infoContainer.className = "details-info";

            function createSection(title, iconClass) {
              const section = document.createElement("div");
              section.className = "detail-section";
              section.innerHTML = `
                <div class="section-header">
                  <i class="fa-solid ${iconClass}"></i>
                  <span>${title}</span>
                </div>
                <div class="section-body"></div>
              `;
              return section;
            }

            function addItem(section, label, value, icon) {
              if (value == null) return;
              const body = section.querySelector(".section-body");
              const row = document.createElement("div");
              row.className = "detail-item";
              row.innerHTML = `<i class="fa-solid ${icon}"></i><span class="detail-label">${label}</span><span class="detail-value">${value}</span>`;
              body.appendChild(row);
            }

            const locationSection = createSection("Location", "fa-location-dot");
            addItem(locationSection, "Latitude", device.lat, "fa-globe");
            addItem(locationSection, "Longitude", device.lon, "fa-globe");
            addItem(locationSection, "Accuracy", device.acc, "fa-crosshairs");
            infoContainer.appendChild(locationSection);

            if (device.battVoltage || device.battTemp || device.battCurrentDraw || device.battTTE) {
              const batterySection = createSection("Battery", "fa-battery-full");
              addItem(batterySection, "Voltage", device.battVoltage + " V", "fa-bolt");
              addItem(batterySection, "Temperature", device.battTemp + " °C", "fa-temperature-half");
              addItem(batterySection, "Current Draw", device.battCurrentDraw + " A", "fa-gauge");
              addItem(batterySection,"Time To Empty",formatTimeToEmpty(device.battTTE),"fa-clock");
              infoContainer.appendChild(batterySection);
            }

            if (device.mmc || device.mnc || device.tac || device.band || device.cellId) {
              const cellSection = createSection("Cell Network", "fa-tower-cell");
              addItem(cellSection, "MMC", device.mmc, "fa-sim-card");
              addItem(cellSection, "MNC", device.mnc, "fa-sim-card");
              addItem(cellSection, "TAC", device.tac, "fa-broadcast-tower");
              addItem(cellSection, "Band", device.band, "fa-wave-square");
              addItem(cellSection, "Cell ID", device.cellId, "fa-circle-nodes");
              infoContainer.appendChild(cellSection);
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

        tbody.appendChild(mainRow);
        tbody.appendChild(detailsRow);
      });
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

    // Attach sorting
    table.querySelectorAll("th.sortable").forEach(th => {
      th.style.cursor = "pointer";
      th.addEventListener("click", () => {
        const key = th.dataset.key;
        sortDevices(key);
      });
    });

    // Initial render
    renderRows(org.devices);
    container.appendChild(table);
  }
}

function formatTimeToEmpty(tte) {
  if (!tte) return null;

  const date = new Date(tte);
  if (isNaN(date)) return tte; // fallback if invalid

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const dayName = date.toLocaleDateString("en-GB", { weekday: "short" }); // Mon, Tue, etc.
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  return `${hours}:${minutes} ${dayName} ${day}/${month}/${year}`;
}
  
  
  
async function init() {
  const devicesData = await fetchDevicesWithAuth();
  if (devicesData) {
    renderDevices(devicesData);
  }
}

// Call it
init();
