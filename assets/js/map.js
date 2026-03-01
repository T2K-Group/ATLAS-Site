// -------------------------
// Global map and layers
// -------------------------
let map;
const orgLayers = {};       // LayerGroup per org
const orgMarkers = {};      // Track device markers per org
const orgSiteLayers = {};   // LayerGroup per org for sites

document.addEventListener("DOMContentLoaded", async () => {
  map = L.map("map", { zoomControl: true, fullscreenControl: true }).setView([54.5, -3], 6);

  // Base maps
  const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
  }).addTo(map);

  const satLayer = L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
  });

  const baseMaps = { "OpenStreetMap": osmLayer, "Satellite": satLayer };
  const overlayMaps = {};
  const layerControl = L.control.layers(baseMaps, overlayMaps, { collapsed: true }).addTo(map);

  // Fix map resize on sidebar toggle
  const toggle = document.getElementById("sidepanel-toggler");
  toggle?.addEventListener("click", () => setTimeout(() => map.invalidateSize(), 300));

  // Initial render & polling every 5s
  await updateMapMarkers(layerControl, overlayMaps);
  setInterval(() => updateMapMarkers(layerControl, overlayMaps), 5000);
});

// -------------------------
// Add or update a device marker
// -------------------------
function addOrUpdateMarker(orgName, device) {
  if (!orgLayers[orgName]) {
    orgLayers[orgName] = L.layerGroup().addTo(map);
    orgMarkers[orgName] = {};
  }

  const markers = orgMarkers[orgName];
  let marker = markers[device.name];

  if (marker) {
    const moved = marker.getLatLng().lat !== device.lat || marker.getLatLng().lng !== device.lon;
    const changedBatt = marker.options.battPercent !== device.battPercent;
    const changedAcc = marker.options.acc !== device.acc;

    if (!moved && !changedBatt && !changedAcc) return;

    if (moved) marker.setLatLng([device.lat, device.lon]);
    marker.setPopupContent(
      `<strong>${device.name}</strong><br>` +
      `Battery: ${device.battPercent ?? "N/A"}<br>` +
      `Last Seen: ${new Date(device.lastSeen).toLocaleString()}`
    );
    marker.options.battPercent = device.battPercent;
    marker.options.acc = device.acc;

    if (marker.circle) {
      marker.circle.setLatLng([device.lat, device.lon]);
      marker.circle.setRadius(device.acc || 0);
    }
  } else {
    marker = L.marker([device.lat, device.lon], { battPercent: device.battPercent, acc: device.acc });
    marker.bindPopup(
      `<strong>${device.name}</strong><br>` +
      `Battery: ${device.battPercent ?? "N/A"}<br>` +
      `Last Seen: ${new Date(device.lastSeen).toLocaleString()}`
    );

    if (device.acc != null) {
      const circle = L.circle([device.lat, device.lon], {
        radius: device.acc,
        color: "blue",
        fillColor: "#3f51b5",
        fillOpacity: 0.2
      });
      circle.addTo(orgLayers[orgName]);
      marker.circle = circle;
    }

    marker.addTo(orgLayers[orgName]);
    markers[device.name] = marker;
  }
}

// -------------------------
// Cleanup removed markers
// -------------------------
function cleanupMarkers(orgName, currentDevices) {
  const markers = orgMarkers[orgName];
  if (!markers) return;

  const currentNames = new Set(currentDevices.map(d => d.name));
  for (const name in markers) {
    if (!currentNames.has(name)) {
      orgLayers[orgName].removeLayer(markers[name]);
      if (markers[name].circle) map.removeLayer(markers[name].circle);
      delete markers[name];
    }
  }
}

// -------------------------
// Render sites per org
// -------------------------
function renderSites(sitesData, layerControl) {
  if (!sitesData || !sitesData.data) return;

  console.log("picking sites")

  for (const orgId in sitesData.data) {
    const org = sitesData.data[orgId];
    const orgName = org.org_name || `Org ${orgId}`;

    if (!orgSiteLayers[orgName]) orgSiteLayers[orgName] = L.layerGroup().addTo(map);
    const sitesLayer = orgSiteLayers[orgName];

    org.sites.forEach(site => {
      if (!(site.active === 1)) return;

      // Polygon
      if (Array.isArray(site.polygon_points) && site.polygon_points.length > 2) {
        const latlngs = site.polygon_points.map(p => [p.lat, p.lon]);
        L.polygon(latlngs, {
          color: site.hq ? "#26a69a" : "#DC143C",
          fillOpacity: 0.1
        }).addTo(sitesLayer);
      }

      console.log("adding polygone for ", site)

      // Optional radius circle
      if (site.radius) {
        L.circle([site.centroid_lat, site.centroid_lon], {
          radius: site.radius,
          color: site.hq ? "#26a69a" : "#DC143C",
          fillOpacity: 0.05
        }).addTo(sitesLayer);
      }
    });

    layerControl.addOverlay(sitesLayer, `${orgName} – Sites`);
  }
}

// -------------------------
// Fetch & update map from IndexedDB
// -------------------------
async function updateMapMarkers(layerControl, overlayMaps) {
  // Fetch devices + sites, store in IndexedDB
  const apiData = await fetchAndSaveAtlasData(false); // <--- use your function now

  // Get merged device/org structure from IndexedDB
  const data = await getDevicesByOrgAndSite();

  for (const orgId in data) {
    const org = data[orgId];
    const orgName = org.orgName || `Org ${orgId}`;

    // Flatten devices including unassigned
    const devices = [];
    for (const siteId in org.sites) {
      devices.push(...org.sites[siteId].devices);
    }

    devices.forEach(device => addOrUpdateMarker(orgName, device));
    cleanupMarkers(orgName, devices);
  }

  // Render sites only once
  if (!updateMapMarkers.sitesRendered && apiData?.sites) {
    renderSites(apiData.sites, layerControl);
    updateMapMarkers.sitesRendered = true;
  }
}