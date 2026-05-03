const lastDeviceState = {};
let map = null;
let mapMarker = null;
let locationModal = null;
let settingsModal = null;
let currentUserRole = 0;
let settingsCurrentDevice = null;

// In-memory store
let atlasData = {
  orgs: {},
  sites: {},
  devices: {}
};

function getCookie(name) {
  return document.cookie
    .split("; ")
    .find(row => row.startsWith(name + "="))
    ?.split("=")[1];
}

// -------------------------
// AUTH
// -------------------------
async function checkAuth() {
  const sessionId = getCookie("session_id");

  if (!sessionId) {
    window.location.href = "/login.html";
    return;
  }

  try {
    const response = await fetch("https://atlasapi.t2k.group/whoami", {
      headers: { "Authorization": `Bearer ${sessionId}` }
    });

    if (!response.ok) throw new Error();

    const result = await response.json();
    if (!result.status) {
      window.location.href = "/login.html";
      return;
    }

    const user = result.data;

    const orgImg = document.getElementById("org-img");
    if (orgImg && user.orglogo) {
      orgImg.src = user.orglogo;
      orgImg.hidden = false;
    }

    if (user.role !== 1) {
      document.querySelectorAll(".user-hide").forEach(el => el.hidden = false);
    }

    if (user.role > 2) {
      document.querySelectorAll(".la-hide").forEach(el => el.hidden = false);
    }

    window.currentUser = user;

  } catch {
    window.location.href = "/login.html";
  }
}

// -------------------------
// FETCH + STORE (IN MEMORY)
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
      fetch(deviceUrl, { headers: { Authorization: `Bearer ${token}` } }),
      fetch("https://atlasapi.t2k.group/fetch/sites", { headers: { Authorization: `Bearer ${token}` } })
    ]);

    const devicesData = await deviceRes.json();
    const sitesData = await siteRes.json();

    if (devicesData?.data?.fetch_ts) {
      localStorage.setItem("delta_ts", devicesData.data.fetch_ts);
    }

    // --- STORE IN MEMORY ---

    // Orgs + Devices
    for (const orgId in devicesData.data) {
      if (orgId === "fetch_ts") continue;

      const org = devicesData.data[orgId];
      atlasData.orgs[orgId] = { orgName: org.orgName };

      org.devices.forEach(dev => {
        atlasData.devices[dev.deviceId] = { ...dev, orgId };
      });
    }

    // Sites
    for (const orgId in sitesData.data) {
      sitesData.data[orgId].sites.forEach(site => {
        atlasData.sites[site.id] = { ...site, orgId };
      });
    }

  } catch (err) {
    console.error("Fetch error:", err);
  }
}

// -------------------------
// STRUCTURE DATA
// -------------------------
function getStructuredData() {
  const result = {};

  Object.entries(atlasData.orgs).forEach(([orgId, org]) => {
    result[orgId] = { orgName: org.orgName, sites: {} };
  });

  Object.values(atlasData.sites).forEach(site => {
    if (!result[site.orgId]) return;
    result[site.orgId].sites[site.id] = { ...site, devices: [] };
  });

  Object.values(atlasData.devices).forEach(dev => {
    const org = result[dev.orgId];
    if (!org) return;

    if (dev.atSite?.length) {
      dev.atSite.forEach(siteId => {
        if (org.sites[siteId]) {
          org.sites[siteId].devices.push(dev);
        }
      });
    } else {
      if (!org.sites["_unassigned"]) {
        org.sites["_unassigned"] = {
          id: "_unassigned",
          name: "Unassigned",
          devices: []
        };
      }
      org.sites["_unassigned"].devices.push(dev);
    }
  });

  return result;
}

// -------------------------
// RENDER
// -------------------------
async function renderDevicesTable() {
  const container = document.getElementById("device-container");
  if (!container) return;

  const data = getStructuredData();

  container.innerHTML = "";

  for (const orgId in data) {
    const org = data[orgId];

    const orgCard = document.createElement("div");
    orgCard.className = "card mb-4";
    orgCard.innerHTML = `
      <div class="card-header bg-primary text-white">${org.orgName}</div>
      <div class="card-body"></div>
    `;

    const body = orgCard.querySelector(".card-body");

    for (const siteId in org.sites) {
      const site = org.sites[siteId];

      const section = document.createElement("div");
      section.innerHTML = `
        <h5>${site.name}</h5>
        <table class="table table-sm">
          <tbody></tbody>
        </table>
      `;

      const tbody = section.querySelector("tbody");

      site.devices.forEach(dev => {
        const row = document.createElement("tr");

        row.innerHTML = `
          <td>${dev.name}</td>
          <td>${dev.battPercent}</td>
          <td>${timeAgo(dev.lastSeen)}</td>
        `;

        tbody.appendChild(row);
      });

      body.appendChild(section);
    }

    container.appendChild(orgCard);
  }

  checkAuth();
}

// -------------------------
// POLLING
// -------------------------
async function fetchAndUpdateDevices() {
  await fetchAndStoreAtlasData(false);
  renderDevicesTable();
}

function startDevicePolling() {
  fetchAndUpdateDevices();
  setInterval(fetchAndUpdateDevices, 5000);
}

// -------------------------
// UTILS
// -------------------------
function timeAgo(timestamp) {
  if (!timestamp) return "-";
  const seconds = Math.floor((Date.now() - new Date(timestamp)) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// -------------------------
// INIT
// -------------------------
async function init() {
  localStorage.removeItem("delta_ts");

  await fetchAndStoreAtlasData(true);
  await renderDevicesTable();

  startDevicePolling();
  setInterval(renderDevicesTable, 1000);
}

init();