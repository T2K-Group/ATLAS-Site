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

    // ✅ Move initMap call here
    initMap(layerControl, overlayMaps);
});



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
            // Skip inactive sites
            if (!site.active) return;

            // Use centroid for marker
            const lat = site.centroid_lat;
            const lon = site.centroid_lon;

            if (lat == null || lon == null) return;

            // Draw polygon if polygon_points exist
            if (Array.isArray(site.polygon_points) && site.polygon_points.length > 2) {
                const latlngs = site.polygon_points.map(p => [p.lat, p.lon]);
                const polygon = L.polygon(latlngs, {
                    color: site.hq ? "#26a69a" : "#DC143C",
                    fillOpacity: 0.1
                });
                sitesLayer.addLayer(polygon);
            }

            // Draw circle for radius if provided
            if (site.radius) {
                const circle = L.circle([lat, lon], {
                    radius: site.radius,
                    color: site.hq ? "#26a69a" : "#DC143C",
                    fillOpacity: 0.05
                });
                sitesLayer.addLayer(circle);
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

  // -------------------------
// IndexedDB helper (same DB as fetchDevices.js)
// -------------------------
async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("DevicesDB", 1);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("orgs")) db.createObjectStore("orgs", { keyPath: "orgId" });
      if (!db.objectStoreNames.contains("devices")) {
        const store = db.createObjectStore("devices", { keyPath: "name" });
        store.createIndex("orgId", "orgId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// -------------------------
// Get devices from IndexedDB
// -------------------------
async function getDevicesFromDB() {
  const db = await openDB();
  const tx = db.transaction(["orgs", "devices"], "readonly");
  const orgStore = tx.objectStore("orgs");
  const deviceStore = tx.objectStore("devices");

  const orgsArray = await new Promise((resolve, reject) => {
    const req = orgStore.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  const devices = await new Promise((resolve, reject) => {
    const req = deviceStore.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  const orgsObj = {};
  orgsArray.forEach(org => {
    orgsObj[org.orgId] = {
      orgName: org.orgName,
      devices: devices.filter(d => d.orgId === org.orgId)
    };
  });

  return orgsObj;
}

// -------------------------
// Map initialization using IndexedDB devices
// -------------------------
async function initMap(layerControl, overlayMaps) {
  // 1️⃣ Load devices from IndexedDB
  const orgs = await getDevicesFromDB();

  if (!orgs) return;
  const allMarkers = [];

  for (const orgId in orgs) {
    const org = orgs[orgId];
    const orgName = org.orgName || `Org ${orgId}`;

    // Create LayerGroup for this org
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

  // 2️⃣ Sites remain unchanged
  const sitesData = await fetchSitesWithAuth();
  renderSitesPerOrg(sitesData, layerControl);
}
