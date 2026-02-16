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
  
  // Call the function
  const devicesData = fetchDevicesWithAuth();
  
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
    full: { icon: "fa-battery-full", color: "DarkGreen" },
    high: { icon: "fa-battery-three-quarters", color: "ForestGreen" },
    med: { icon: "fa-battery-half", color: "GoldenRod" },
    low: { icon: "fa-battery-quarter", color: "Orange" },
    crit: { icon: "fa-battery-empty", color: "Red" }
  };

  for (const orgId in orgs) {
    const org = orgs[orgId];

    const orgTitle = document.createElement("h2");
    orgTitle.className = "org-title";
    orgTitle.textContent = org.orgName || "Unknown Org";
    container.appendChild(orgTitle);

    const wrapper = document.createElement("div");
    wrapper.className = "devices-wrapper";

    org.devices.forEach(device => {

      const card = document.createElement("div");
      card.className = "device-card";

      /* -------- MAP LEFT -------- */

      if (device.lat && device.lon) {
        const map = document.createElement("div");
        map.className = "device-map";

        const img = document.createElement("img");
        img.src = `https://maps.t2k.group?lat=${device.lat}&lon=${device.lon}&zoom=13&size=300x200`;

        map.appendChild(img);
        card.appendChild(map);
      }

      /* -------- CONTENT RIGHT -------- */

      const content = document.createElement("div");
      content.className = "device-content";

      /* HEADER */

      const header = document.createElement("div");
      header.className = "device-header";

      const name = document.createElement("div");
      name.className = "device-name";
      name.textContent = device.name || device.deviceName || "Unnamed Device";

      const meta = document.createElement("div");
      meta.className = "device-meta";

      if (device.battPercent != null) {
        if (typeof device.battPercent === "number") {
          meta.innerHTML += `<strong>${device.battPercent}%</strong>`;
        } else {
          const icon = batteryIcons[device.battPercent.toLowerCase()] || batteryIcons.crit;
          meta.innerHTML += `<i class="fa-solid ${icon.icon}" style="color:${icon.color}; font-size:18px;"></i>`;
        }
      }

      header.appendChild(name);
      header.appendChild(meta);

      content.appendChild(header);

      /* INFO GRID */

      const infoGrid = document.createElement("div");
      infoGrid.className = "device-info-grid";

      function addInfo(iconClass, label, value) {
        if (value == null) return;

        const item = document.createElement("div");
        item.className = "device-info-item";
        item.innerHTML = `
          <i class="fa-solid ${iconClass}"></i>
          <span><strong>${label}:</strong> ${value}</span>
        `;
        infoGrid.appendChild(item);
      }

      addInfo("fa-location-dot", "Lat", device.lat);
      addInfo("fa-location-dot", "Lon", device.lon);
      addInfo("fa-crosshairs", "Accuracy", device.acc);
      addInfo("fa-barcode", "IMEI", device.imei);
      addInfo("fa-gauge", "Speed", device.speed);

      if (device.lastSeen) {
        addInfo("fa-clock", "Last seen", timeAgo(device.lastSeen));
      }

      content.appendChild(infoGrid);
      card.appendChild(content);
      wrapper.appendChild(card);
    });

    container.appendChild(wrapper);
  }
}


  
  
  
async function init() {
  const devicesData = await fetchDevicesWithAuth();
  if (devicesData) {
    renderDevices(devicesData);
  }
}

// Call it
init();
