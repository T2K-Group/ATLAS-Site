let map
const orgLayers = {}
const orgMarkers = {}

let currentTime = 0
let timer = null
let speed = 10

const API = "https://atlas-demo.t2k.group/demo"

const timeTicker = document.querySelector(".time-ticker")

function updateTimeTicker() {
    let updatedtime = currentTime + 3600000
    if (!timeTicker) return
    const date = new Date(updatedtime)
    // Format: YYYY-MM-DD HH:mm:ss
    const formatted = date.toLocaleString()
    timeTicker.textContent = formatted
}

// -------------------------
// DOM elements
// -------------------------
const startInput = document.getElementById("startTime")
const speedSlider = document.getElementById("speedSlider")
const speedLabel = document.getElementById("speedLabel")
const startBtn = document.getElementById("startBtn")
const stopBtn = document.getElementById("stopBtn")

speedSlider.addEventListener("input", () => {
    speed = parseInt(speedSlider.value)
    speedLabel.innerText = speed + "x"
})

// -------------------------
// Initialize map
// -------------------------
document.addEventListener("DOMContentLoaded", () => {

  map = L.map("map", {
    zoomControl: true,
    fullscreenControl: true
  }).setView([54.5, -3], 6)

  // Base maps
  const osmLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { attribution: "© OpenStreetMap contributors" }
  ).addTo(map)

  const satLayer = L.tileLayer(
    "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    { attribution: "© OpenStreetMap contributors" }
  )

  const baseMaps = {
    "OpenStreetMap": osmLayer,
    "Satellite": satLayer
  }

  L.control.layers(baseMaps).addTo(map)

})

// -------------------------
// Marker icon
// -------------------------
const smallDeviceIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",

  iconSize: [14, 22],
  iconAnchor: [7, 22],
  popupAnchor: [1, -18],
  shadowSize: [22, 22]
})

// -------------------------
// Add or update marker
// -------------------------
function addOrUpdateMarker(orgName, device) {

  if (device.lat == null || device.lon == null || isNaN(device.lat) || isNaN(device.lon))
      return

  if (!orgLayers[orgName]) {
    orgLayers[orgName] = L.layerGroup().addTo(map)
    orgMarkers[orgName] = {}
  }

  const markers = orgMarkers[orgName]
  let marker = markers[device.name]

  if (marker) {
    marker.setLatLng([device.lat, device.lon])
    marker.setPopupContent(
      `<strong>${device.name}</strong><br>
       Battery: ${device.battPercent ?? "N/A"}<br>
       Last Seen: ${new Date(device.lastSeen).toLocaleString()}`
    )
    if (marker.circle) {
      marker.circle.setLatLng([device.lat, device.lon])
      marker.circle.setRadius(device.acc || 0)
    }
  } else {
    marker = L.marker([device.lat, device.lon], { icon: smallDeviceIcon })
    marker.bindPopup(
      `<strong>${device.name}</strong><br>
       Battery: ${device.battPercent ?? "N/A"}<br>
       Last Seen: ${new Date(device.lastSeen).toLocaleString()}`
    )

    if (device.acc) {
      const circle = L.circle([device.lat, device.lon], {
        radius: device.acc,
        color: "blue",
        fillColor: "#3f51b5",
        fillOpacity: 0.2
      }).addTo(orgLayers[orgName])
      marker.circle = circle
    }

    marker.addTo(orgLayers[orgName])
    markers[device.name] = marker
  }
}

// -------------------------
// Remove missing markers
// -------------------------
function cleanupMarkers(orgName, devices) {
  const markers = orgMarkers[orgName]
  if (!markers) return

  const active = new Set(devices.map(d => d.name))
  for (const name in markers) {
    if (!active.has(name)) {
      orgLayers[orgName].removeLayer(markers[name])
      if (markers[name].circle) map.removeLayer(markers[name].circle)
      delete markers[name]
    }
  }
}

// -------------------------
// Update devices (called by fetch)
// -------------------------
function updateDemoDevices(data) {
  if (!data || !data.data) return

  for (const orgId in data.data) {
    const org = data.data[orgId]
    const orgName = org.orgName || `Org ${orgId}`
    const devices = org.devices || []

    devices.forEach(device => addOrUpdateMarker(orgName, device))
    cleanupMarkers(orgName, devices)
  }
}

// -------------------------
// Start / Stop simulation
// -------------------------
startBtn.onclick = () => {
    const startDate = new Date(startInput.value)
    currentTime = startDate.getTime() - 3600000

    if (timer) clearInterval(timer)

    timer = setInterval(() => {
        fetch(API + "?ts=" + currentTime)
          .then(r => r.json())
          .then(data => updateDemoDevices(data))
          .catch(err => console.error("Fetch error:", err))

        // advance simulated time
        updateTimeTicker()


        currentTime += speed * 1000
    }, 1000)
}

stopBtn.onclick = () => {
    if (timer) {
        clearInterval(timer)
        timer = null
    }
}
