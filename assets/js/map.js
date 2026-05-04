// =========================
// GLOBAL STATE
// =========================
window.atlasData = window.atlasData || {
  orgs: {},
  sites: {},
  devices: {}
};

const orgLayers = {};
const orgMarkers = {};
const orgSiteLayers = {};

let map;
let layerControl;

// =========================
// INIT MAP
// =========================
document.addEventListener("DOMContentLoaded", async () => {

  map = L.map("map").setView([54.5, -3], 6);

  const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map);

  const sat = L.tileLayer("https://khms0.google.com/kh/v=1008?x={x}&y={y}&z={z}");
  const dark = L.tileLayer("https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png");

  layerControl = L.control.layers(
    {
      "OSM": osm,
      "Satellite": sat,
      "Dark": dark
    },
    {},
    { collapsed: true }
  ).addTo(map);

  document.getElementById("sidepanel-toggler")
    ?.addEventListener("click", () => setTimeout(() => map.invalidateSize(), 200));

  await fetchAll(true);
  renderAll();

  setInterval(async () => {
    await fetchAll(false);
    renderDevices();
  }, 5000);

  setInterval(async () => {
    await fetchSitesOnly();
    renderSites();
  }, 300000);
});


// =========================
// FETCH DEVICES (DELTA SAFE MERGE)
// =========================
async function fetchAll(forceFull) {

  const token = getCookie("session_id");
  if (!token) return;

  let ts = localStorage.getItem("delta_ts") || 0;
  if (forceFull) ts = 0;

  const url = ts
    ? `https://atlasapi.t2k.group/fetch/devices?timestamp=${ts}`
    : `https://atlasapi.t2k.group/fetch/devices`;

  const [devicesRes, sitesRes] = await Promise.all([
    fetch(url, { headers: { Authorization: `Bearer ${token}` } }),
    fetch("https://atlasapi.t2k.group/fetch/sites", {
      headers: { Authorization: `Bearer ${token}` }
    })
  ]);

  const devicesData = await devicesRes.json();
  const sitesData = await sitesRes.json();

  console.log("DEVICES RAW:", devicesData);

  if (devicesData?.data?.fetch_ts) {
    localStorage.setItem("delta_ts", devicesData.data.fetch_ts);
  }

  // =========================
  // MERGE DEVICES
  // =========================
  for (const orgId in devicesData.data) {

    if (orgId === "fetch_ts") continue;

    const org = devicesData.data[orgId];
    if (!org?.devices) continue;

    window.atlasData.orgs[orgId] = {
      orgName: org.orgName
    };

    for (const d of org.devices) {

      if (!d?.deviceId) continue;

      window.atlasData.devices[d.deviceId] = {
        ...(window.atlasData.devices[d.deviceId] || {}),
        ...d,
        orgId
      };
    }
  }

  // =========================
  // SITES
  // =========================
  window.atlasData.sites = {};

  for (const orgId in sitesData.data) {
    const org = sitesData.data[orgId];

    (org.sites || []).forEach(site => {
      window.atlasData.sites[site.id] = {
        ...site,
        orgId
      };
    });
  }
}


// =========================
// MASTER RENDER
// =========================
function renderAll() {
  renderDevices();
  renderSites();
}


// =========================
// DEVICE RENDER
// =========================
function renderDevices() {

  const devices = Object.values(window.atlasData.devices || []);
  if (!devices.length) return;

  const grouped = {};

  for (const d of devices) {

    const orgName =
      window.atlasData.orgs?.[d.orgId]?.orgName ||
      `Org ${d.orgId}`;

    if (!grouped[orgName]) grouped[orgName] = [];
    grouped[orgName].push(d);
  }

  for (const orgName in grouped) {

    if (!orgLayers[orgName]) {
      orgLayers[orgName] = L.layerGroup().addTo(map);
      orgMarkers[orgName] = {};
    }

    const markers = orgMarkers[orgName];
    const active = new Set();

    grouped[orgName].forEach(device => {
      active.add(device.deviceId);
      addOrUpdateMarker(orgName, device);
    });

    cleanupMarkers(orgName, active);
  }
}


// =========================
// MARKER + ACCURACY CIRCLE (FIXED)
// =========================
function addOrUpdateMarker(orgName, device) {

  const lat = Number(device.lat);
  const lon = Number(device.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  const markers = orgMarkers[orgName];
  let marker = markers[device.deviceId];

  function timeAgo(timestamp) {
    if (!timestamp) return "-";
    const seconds = Math.floor((Date.now() - new Date(timestamp)) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  const lastSeenFormatted = device.lastSeen
    ? `${timeAgo(device.lastSeen)} (${new Date(device.lastSeen).toLocaleString()})`
    : "N/A";

  const popup = `
    <b>${device.name}</b><br>
    Battery: ${device.battPercent ?? "N/A"}%<br>
    Accuracy: ${device.acc ?? "N/A"} m<br>
    Last Seen: ${lastSeenFormatted}
  `;

  // =========================
  // UPDATE EXISTING
  // =========================
  if (marker) {

    marker.setLatLng([lat, lon]);
    marker.setPopupContent(popup);

    // UPDATE CIRCLE
    if (marker.circle) {
      marker.circle.setLatLng([lat, lon]);
      marker.circle.setRadius(device.acc || 0);
    }

    return;
  }

  // =========================
  // CREATE MARKER
  // =========================
  marker = L.marker([lat, lon])
    .bindPopup(popup)
    .addTo(orgLayers[orgName]);

  // =========================
  // CREATE ACCURACY CIRCLE
  // =========================
  const circle = L.circle([lat, lon], {
    radius: device.acc || 0,
    color: "#40a02b",
    fillColor: "#40a02b",
    fillOpacity: 0.15,
    weight: 1
  }).addTo(orgLayers[orgName]);

  marker.circle = circle;

  markers[device.deviceId] = marker;
}


// =========================
// CLEANUP
// =========================
function cleanupMarkers(orgName, activeSet) {

  const markers = orgMarkers[orgName];
  if (!markers) return;

  for (const id in markers) {
    if (!activeSet.has(Number(id))) {

      if (markers[id].circle) {
        orgLayers[orgName].removeLayer(markers[id].circle);
      }

      orgLayers[orgName].removeLayer(markers[id]);
      delete markers[id];
    }
  }
}


// =========================
// SITES
// =========================
function renderSites() {

  for (const site of Object.values(window.atlasData.sites || [])) {

    const orgName =
      window.atlasData.orgs?.[site.orgId]?.orgName ||
      `Org ${site.orgId}`;

    if (!orgSiteLayers[orgName]) {
      orgSiteLayers[orgName] = L.layerGroup().addTo(map);
      layerControl.addOverlay(orgSiteLayers[orgName], `${orgName} Sites`);
    }

    const layer = orgSiteLayers[orgName];

    if (Array.isArray(site.polygon_points)) {

      const latlngs = site.polygon_points
        .filter(p => p?.lat != null && p?.lon != null)
        .map(p => [Number(p.lat), Number(p.lon)]);

      if (latlngs.length >= 3) {
        L.polygon(latlngs, {
          color: site.hq ? "#fe640b" : "#8839ef",
          fillOpacity: 0.1
        }).addTo(layer);
      }
    }
  }
}


// =========================
// COOKIE
// =========================
function getCookie(name) {
  return document.cookie
    .split("; ")
    .find(r => r.startsWith(name + "="))
    ?.split("=")[1];
}