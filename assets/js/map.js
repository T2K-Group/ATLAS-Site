// -------------------------
// GLOBAL SAFE STATE
// -------------------------
window.atlasData = window.atlasData || {
  orgs: {},
  sites: {},
  devices: {}
};

// -------------------------
// Global map and layers
// -------------------------
const orgLayers = {};
const orgMarkers = {};
const orgSiteLayers = {};

let map = null;
let layerControl = null;

// -------------------------
// INIT MAP
// -------------------------
document.addEventListener("DOMContentLoaded", async () => {

  map = L.map("map", {
    zoomControl: true,
    fullscreenControl: true
  }).setView([54.5, -3], 6);

  const osmLayer = L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    { attribution: "© OpenStreetMap contributors" }
  ).addTo(map);

  const satLayer = L.tileLayer(
    "https://khms0.google.com/kh/v=1008?x={x}&y={y}&z={z}",
    { attribution: "© Google Maps" }
  );

  const darkLayer = L.tileLayer(
    "https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
    { attribution: "© Carto / OSM" }
  );

  layerControl = L.control.layers(
    {
      "OpenStreetMap": osmLayer,
      "Satellite": satLayer,
      "Dark Mode": darkLayer
    },
    {},
    { collapsed: true }
  ).addTo(map);

  document.getElementById("sidepanel-toggler")
    ?.addEventListener("click", () => setTimeout(() => map.invalidateSize(), 300));

  // -------------------------
  // IMPORTANT FIX:
  // Fetch FIRST, then render
  // -------------------------
  await fetchAndStoreAtlasData(true);
  await refreshMap();

  // polling loop
  setInterval(refreshMap, 5000);
});


// -------------------------
// MASTER REFRESH FUNCTION
// -------------------------
async function refreshMap() {
  await fetchAndStoreAtlasData(false);
  renderSites();
  renderDevices();
}


// -------------------------
// FETCH DATA INTO MEMORY ONLY
// -------------------------
async function fetchAndStoreAtlasData(forceFull = false) {

  const token = getCookie("session_id");
  if (!token) return;

  let delta_ts = localStorage.getItem("delta_ts");
  if (!delta_ts || forceFull) delta_ts = 0;

  try {
    let deviceUrl = "https://atlasapi.t2k.group/fetch/devices";
    if (delta_ts) deviceUrl += `?timestamp=${delta_ts}`;

    const [deviceRes, siteRes] = await Promise.all([
      fetch(deviceUrl, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch("https://atlasapi.t2k.group/fetch/sites", {
        headers: { Authorization: `Bearer ${token}` }
      })
    ]);

    const devicesData = await deviceRes.json();
    const sitesData = await siteRes.json();

    if (devicesData?.data?.fetch_ts) {
      localStorage.setItem("delta_ts", devicesData.data.fetch_ts);
    }

    // reset store (prevents ghost devices)
    window.atlasData = {
      orgs: {},
      sites: {},
      devices: {}
    };

    // -------------------------
    // ORGS + DEVICES
    // -------------------------
    for (const orgId in devicesData.data) {
      if (orgId === "fetch_ts") continue;

      const org = devicesData.data[orgId];

      window.atlasData.orgs[orgId] = {
        orgName: org.orgName
      };

      org.devices.forEach(dev => {
        window.atlasData.devices[dev.deviceId] = {
          ...dev,
          orgId
        };
      });
    }

    // -------------------------
    // SITES
    // -------------------------
    for (const orgId in sitesData.data) {
      sitesData.data[orgId].sites.forEach(site => {
        window.atlasData.sites[site.id] = {
          ...site,
          orgId
        };
      });
    }

  } catch (err) {
    console.error("Fetch error:", err);
  }
}


// -------------------------
// DEVICE RENDERING
// -------------------------
function renderDevices() {

  if (!window.atlasData?.devices) return;

  const grouped = {};

  for (const dev of Object.values(window.atlasData.devices)) {
    const orgId = dev.orgId;
    const orgName = window.atlasData.orgs?.[orgId]?.orgName || `Org ${orgId}`;

    if (!grouped[orgName]) grouped[orgName] = [];
    grouped[orgName].push(dev);
  }

  for (const orgName in grouped) {
    const devices = grouped[orgName];

    if (!orgLayers[orgName]) {
      orgLayers[orgName] = L.layerGroup().addTo(map);
      orgMarkers[orgName] = {};
    }

    const markers = orgMarkers[orgName];

    const active = new Set();

    devices.forEach(device => {
      active.add(device.deviceId);
      addOrUpdateMarker(orgName, device);
    });

    cleanupMarkers(orgName, active);
  }
}


// -------------------------
// MARKERS
// -------------------------
function addOrUpdateMarker(orgName, device) {

  if (!device.lat || !device.lon) return;

  const markers = orgMarkers[orgName];
  let marker = markers[device.deviceId];

  const icon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [14, 22],
    iconAnchor: [7, 22],
    popupAnchor: [1, -18]
  });

  const popup = `
    <b>${device.name}</b><br>
    Battery: ${device.battPercent ?? "N/A"}<br>
    Last Seen: ${device.lastSeen ? new Date(device.lastSeen).toLocaleString() : "N/A"}
  `;

  if (marker) {
    marker.setLatLng([device.lat, device.lon]);
    marker.setPopupContent(popup);
    return;
  }

  marker = L.marker([device.lat, device.lon], { icon })
    .bindPopup(popup)
    .addTo(orgLayers[orgName]);

  markers[device.deviceId] = marker;
}


// -------------------------
// CLEANUP
// -------------------------
function cleanupMarkers(orgName, activeSet) {
  const markers = orgMarkers[orgName];
  if (!markers) return;

  for (const id in markers) {
    if (!activeSet.has(id)) {
      orgLayers[orgName].removeLayer(markers[id]);
      delete markers[id];
    }
  }
}


// -------------------------
// SITES
// -------------------------
function renderSites() {

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
        .filter(p => p?.lat && p?.lon)
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
// COOKIE HELPER
// -------------------------
function getCookie(name) {
  return document.cookie
    .split("; ")
    .find(r => r.startsWith(name + "="))
    ?.split("=")[1];
}