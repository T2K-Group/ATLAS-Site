// -------------------------
// Global map and layers
// -------------------------
const orgLayers = {};
const orgMarkers = {};
const orgSiteLayers = {};

document.addEventListener("DOMContentLoaded", async () => {
  map = L.map("map", {
    zoomControl: true,
    fullscreenControl: true
  }).setView([54.5, -3], 6);

  const osmLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
  }).addTo(map);

  const satLayer = L.tileLayer("https://khms0.google.com/kh/v=1008?x={x}&y={y}&z={z}", {
    attribution: "© Google Maps"
  });

  const darkLayer = L.tileLayer(
    "https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
    { attribution: "© Carto / OSM" }
  );

  const layerControl = L.control.layers(
    {
      "OpenStreetMap": osmLayer,
      "Satellite": satLayer,
      "Dark Mode": darkLayer
    },
    {},
    { collapsed: true }
  ).addTo(map);

  document
    .getElementById("sidepanel-toggler")
    ?.addEventListener("click", () => setTimeout(() => map.invalidateSize(), 300));

  await updateMapMarkers(layerControl);

  setInterval(() => updateMapMarkers(layerControl), 5000);
});

// -------------------------
// Add / update marker
// -------------------------
function addOrUpdateMarker(orgName, device) {
  if (
    device.lat == null ||
    device.lon == null ||
    isNaN(device.lat) ||
    isNaN(device.lon)
  ) return;

  if (!orgLayers[orgName]) {
    orgLayers[orgName] = L.layerGroup().addTo(map);
    orgMarkers[orgName] = {};
  }

  const markers = orgMarkers[orgName];
  let marker = markers[device.deviceId];

  const icon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [14, 22],
    iconAnchor: [7, 22],
    popupAnchor: [1, -18],
    shadowSize: [22, 22]
  });

  const popup = `
    <strong>${device.name}</strong><br>
    Battery: ${device.battPercent ?? "N/A"}<br>
    Last Seen: ${device.lastSeen ? new Date(device.lastSeen).toLocaleString() : "N/A"}
  `;

  if (marker) {
    const moved =
      marker.getLatLng().lat !== device.lat ||
      marker.getLatLng().lng !== device.lon;

    if (moved) marker.setLatLng([device.lat, device.lon]);

    marker.setPopupContent(popup);
    return;
  }

  marker = L.marker([device.lat, device.lon], { icon })
    .bindPopup(popup)
    .addTo(orgLayers[orgName]);

  markers[device.deviceId] = marker;
}

// -------------------------
// Cleanup removed markers
// -------------------------
function cleanupMarkers(orgName, currentDevices) {
  const markers = orgMarkers[orgName];
  if (!markers) return;

  const active = new Set(currentDevices.map(d => d.deviceId));

  for (const id in markers) {
    if (!active.has(id)) {
      orgLayers[orgName].removeLayer(markers[id]);
      delete markers[id];
    }
  }
}

// -------------------------
// Render sites (from memory)
// -------------------------
function renderSites(layerControl) {
  if (!window.atlasData?.sites) return;

  for (const site of Object.values(window.atlasData.sites)) {
    const orgName =
      window.atlasData.orgs?.[site.orgId]?.orgName ||
      `Org ${site.orgId}`;

    if (!orgSiteLayers[orgName]) {
      orgSiteLayers[orgName] = L.layerGroup().addTo(map);
      layerControl.addOverlay(orgSiteLayers[orgName], `${orgName} – Sites`);
    }

    const layer = orgSiteLayers[orgName];

    if (Array.isArray(site.polygon_points) && site.polygon_points.length >= 3) {
      const latlngs = site.polygon_points
        .filter(p => p && !isNaN(p.lat) && !isNaN(p.lon))
        .map(p => [p.lat, p.lon]);

      if (latlngs.length >= 3) {
        L.polygon(latlngs, {
          color: site.hq ? "#26a69a" : "#DC143C",
          fillOpacity: 0.1
        }).addTo(layer);
      }
    }

    if (site.radius && site.centroid_lat && site.centroid_lon) {
      L.circle([site.centroid_lat, site.centroid_lon], {
        radius: site.radius,
        color: site.hq ? "#26a69a" : "#DC143C",
        fillOpacity: 0.05
      }).addTo(layer);
    }
  }
}

// -------------------------
// Update map (NO DB)
// -------------------------
async function updateMapMarkers(layerControl) {
  if (!window.atlasData) return;

  const orgMap = {};

  for (const device of Object.values(window.atlasData.devices)) {
    const orgId = device.orgId;
    const orgName =
      window.atlasData.orgs?.[orgId]?.orgName || `Org ${orgId}`;

    if (!orgMap[orgName]) orgMap[orgName] = [];

    orgMap[orgName].push(device);
    addOrUpdateMarker(orgName, device);
  }

  for (const orgName in orgMap) {
    cleanupMarkers(orgName, orgMap[orgName]);
  }

  if (!updateMapMarkers.sitesRendered) {
    renderSites(layerControl);
    updateMapMarkers.sitesRendered = true;
  }
}