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
  


  function renderDevices(devicesData) {
    const container = document.getElementById("devices-container");
    container.innerHTML = "";
  
    const orgs = devicesData.data;
  
    // Battery icon mapping for string values
    const batteryIcons = {
      full: { icon: "fa-battery-full", color: "DarkGreen" },
      high: { icon: "fa-battery-three-quarters", color: "ForestGreen" },
      med: { icon: "fa-battery-half", color: "Yellow" },
      low: { icon: "fa-battery-quarter", color: "Orange" },
      crit: { icon: "fa-battery-empty", color: "OrangeRed" }
    };
  
    for (const orgId in orgs) {
      if (!orgs.hasOwnProperty(orgId)) continue;
  
      const org = orgs[orgId];
      const orgName = org.orgName || "Unknown Org";
  
      // Org title
      const orgTitle = document.createElement("h2");
      orgTitle.textContent = orgName;
      orgTitle.style.marginTop = "24px";
      orgTitle.style.borderBottom = "2px solid #ccc";
      orgTitle.style.paddingBottom = "6px";
      container.appendChild(orgTitle);
  
      const devicesWrapper = document.createElement("div");
      devicesWrapper.style.display = "flex";
      devicesWrapper.style.flexWrap = "wrap";
      devicesWrapper.style.gap = "16px";
  
      // Determine cards per row dynamically
      const totalDevices = org.devices.length;
      const cardsPerRow = Math.min(totalDevices, 5); // max 5 per row
      const cardWidth = `calc(${100 / cardsPerRow}% - ${16 - 16/cardsPerRow}px)`;
  
      org.devices.forEach((device) => {
        const box = document.createElement("div");
        box.style.border = "1px solid #ddd";
        box.style.borderRadius = "10px";
        box.style.padding = "12px";
        box.style.width = cardWidth;
        box.style.fontFamily = "sans-serif";
        box.style.boxShadow = "0 3px 8px rgba(0,0,0,0.12)";
        box.style.backgroundColor = "#fafafa";
        box.style.transition = "transform 0.2s";
        box.onmouseover = () => box.style.transform = "scale(1.03)";
        box.onmouseout = () => box.style.transform = "scale(1)";
  
        // Display fields
        for (const key in device) {
          if (!device.hasOwnProperty(key)) continue;
  
          const value = device[key];
          if (key.toLowerCase() === "battpercent") {
            const line = document.createElement("p");
            line.style.margin = "4px 0";
            if (typeof value === "number") {
              line.innerHTML = `<strong>Battery:</strong> ${value}%`;
            } else if (typeof value === "string") {
              const icon = batteryIcons[value.toLowerCase()] || batteryIcons.crit;
              line.innerHTML = `<strong>Battery:</strong> <span style="color:${icon.color}; font-size:48px;"><i class="fa-solid ${icon.icon}"></i></span>`;
            } else {
              line.innerHTML = `<strong>Battery:</strong> N/A`;
            }
            box.appendChild(line);
            continue;
          }
  
          // Default line
          const line = document.createElement("p");
          line.style.margin = "4px 0";
          line.innerHTML = `<strong>${key}:</strong> ${value !== null ? value : "N/A"}`;
          box.appendChild(line);
        }
  
        // Mini-map for devices with lat/lon
        if (device.lat != null && device.lon != null && device.acc != null) {
          const lat = device.lat;
          const lon = device.lon;
          const zoom = 15;
          const width = 240;
          const height = 150;

          // Use a static map image URL
          const mapImgUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/<lon>,<lat>,<zoom>/<width>x<height>?access_token=YOUR_MAPBOX_ACCESS_TOKEN
          `;

          const img = document.createElement("img");
          img.src = mapImgUrl;
          img.style.width = "100%";
          img.style.height = "150px";
          img.style.borderRadius = "8px";

          box.appendChild(img);
        }
  
        devicesWrapper.appendChild(box);
      });
  
      container.appendChild(devicesWrapper);
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
