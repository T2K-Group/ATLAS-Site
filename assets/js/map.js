let map;
let sitesLayer = L.layerGroup();
const orgSiteLayers = {};



document.addEventListener("DOMContentLoaded", function () {
    map = L.map("map", { zoomControl: true, fullscreenControl: true }).setView([54.5, -3], 6);

    // Base map (OSM)
    const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    // Optional satellite base layer
    const satLayer = L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
    });

    // Add base maps to control
    const baseMaps = {
        "OpenStreetMap": osmLayer,
        "Satellite": satLayer
    };

    // Global overlays object (org layers will go here)
    const overlayMaps = {};

    // Add layer control to map (empty for now)
    const layerControl = L.control.layers(baseMaps, overlayMaps, { collapsed: true }).addTo(map);

    // Fix resize for sidebar toggle
    const toggle = document.getElementById("sidepanel-toggler");
    toggle?.addEventListener("click", () => setTimeout(() => map.invalidateSize(), 300));

    // Load devices and add org layers
    initMap(layerControl, overlayMaps);
});

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

  const orgLayers = {}; // store LayerGroups by org name

function renderOrgLayers(orgs) {
const orgControlDiv = document.createElement("div");
orgControlDiv.className = "org-toggle-controls";
orgControlDiv.style.position = "absolute";
orgControlDiv.style.top = "10px";
orgControlDiv.style.right = "10px";
orgControlDiv.style.background = "#fff";
orgControlDiv.style.padding = "10px";
orgControlDiv.style.borderRadius = "8px";
orgControlDiv.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
orgControlDiv.style.zIndex = 1000;

const allMarkers = []; // <-- collect all markers for fitBounds

for (const orgId in orgs) {
    if (!orgs.hasOwnProperty(orgId)) continue;
    const org = orgs[orgId];
    const orgName = org.orgName || `Org ${orgId}`;
  
    // Create a LayerGroup for this org (empty initially)
    const layerGroup = L.layerGroup();
    orgLayers[orgName] = layerGroup;
  
    org.devices.forEach(device => {
      if (device.lat == null || device.lon == null) return;
  
      // Create marker
      const marker = L.marker([device.lat, device.lon]);
      marker.bindPopup(
        `<strong>${device.name || "Device"}</strong><br>` +
        `Battery: ${device.battPercent ?? "N/A"}<br>` +
        `Last Seen: ${new Date(device.lastSeen).toLocaleString()}`
      );
  
      // Add marker ONLY to LayerGroup
      layerGroup.addLayer(marker);
  
      // Accuracy circle
      if (device.acc != null) {
        const circle = L.circle([device.lat, device.lon], {
          radius: device.acc,
          color: "blue",
          fillColor: "#3f51b5",
          fillOpacity: 0.2
        });
        // Add circle ONLY to LayerGroup
        layerGroup.addLayer(circle);
      }
  
      // Store for bounds calculation
      allMarkers.push(marker);
    });
  
    // Add the LayerGroup to map (default visible)
    layerGroup.addTo(map);
  
    // Add overlay to Layer Control
    overlayMaps[orgName] = layerGroup;
    layerControl.addOverlay(layerGroup, orgName);
  }
  

document.body.appendChild(orgControlDiv);

};


function fitMapToVisibleMarkers(allMarkers) {
    const visibleMarkers = allMarkers.filter(m => map.hasLayer(m));
    if (visibleMarkers.length === 0) return;

    const group = L.featureGroup(visibleMarkers);
    map.fitBounds(group.getBounds(), { padding: [50, 50] });
}

function addLayerControlHeader(text) {
  const overlays = document.querySelector(".leaflet-control-layers-overlays");
  if (!overlays) return;

  const header = document.createElement("div");
  header.className = "layer-group-header";
  header.innerHTML = `<strong>${text}</strong>`;
  header.style.margin = "6px 0 4px";
  header.style.borderTop = "1px solid #ddd";
  header.style.paddingTop = "6px";
  header.style.pointerEvents = "none";

  overlays.appendChild(header);
}


async function fetchSitesWithAuth() {
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
  
    const response = await fetch("https://atlasapi.t2k.group/fetch/sites", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });
  
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  
    return response.json();
  }
    
function renderSitesPerOrg(sitesData, layerControl) {
    if (!sitesData || !sitesData.data) return;
  
    let headerInserted = false;
  
    for (const orgId in sitesData.data) {
      const org = sitesData.data[orgId];
      const orgName = org.org_name || `Org ${orgId}`;
  
      const sitesLayer = L.layerGroup();
      orgSiteLayers[orgName] = sitesLayer;
  
      org.sites.forEach(site => {
        if (site.lat == null || site.lon == null) return;
  
        const marker = L.circleMarker([site.lat, site.lon], {
          radius: 8,
          color: site.active ? "#00695c" : "#9e9e9e",
          fillColor: site.active ? "#26a69a" : "#bdbdbd",
          fillOpacity: 0.9
        });
  
        marker.bindPopup(`
          <strong>${site.name}</strong><br>
          ${site.address}<br>
          Radius: ${site.radius}m<br>
          ${site.active ? "Active" : "Inactive"}
        `);
  
        sitesLayer.addLayer(marker);
  
        if (site.radius) {
          L.circle([site.lat, site.lon], {
            radius: site.radius,
            color: "#26a69a",
            fillOpacity: 0.1
          }).addTo(sitesLayer);
        }
      });
  
      // 🔑 INSERT HEADER *BEFORE* FIRST SITE OVERLAY
      if (!headerInserted) {
        addLayerControlHeader("Sites");
        headerInserted = true;
      }
  
      sitesLayer.addTo(map);
      layerControl.addOverlay(sitesLayer, `${orgName} – Sites`);
    }
  }
  
async function initMap(layerControl, overlayMaps) {
      const devicesData = await fetchDevicesWithAuth();
      if (!devicesData || !devicesData.data) return;
    
      const allMarkers = [];
    
      // -------- DEVICES (unchanged logic) --------
      for (const orgId in devicesData.data) {
        const org = devicesData.data[orgId];
        const orgName = org.orgName || `Org ${orgId}`;
    
        const layerGroup = L.layerGroup();
    
        org.devices.forEach(device => {
          if (device.lat == null || device.lon == null) return;
    
          const marker = L.marker([device.lat, device.lon]);
          marker.bindPopup(
            `<strong>${device.name || "Device"}</strong><br>` +
            `Battery: ${device.battPercent ?? "N/A"}<br>` +
            `Last Seen: ${new Date(device.lastSeen).toLocaleString()}`
          );
    
          layerGroup.addLayer(marker);
          allMarkers.push(marker);
    
          if (device.acc != null) {
            L.circle([device.lat, device.lon], {
              radius: device.acc,
              color: "blue",
              fillColor: "#3f51b5",
              fillOpacity: 0.2
            }).addTo(layerGroup);
          }
        });
    
        layerGroup.addTo(map);
        overlayMaps[orgName] = layerGroup;
        layerControl.addOverlay(layerGroup, orgName);
      }
    
      fitMapToVisibleMarkers(allMarkers);
    
      // -------- SITES --------
      const sitesData = await fetchSitesWithAuth();
      renderSitesPerOrg(sitesData, layerControl);

    }
    
