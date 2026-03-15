let addSiteMap, addSiteMarker, addSiteCircle;
let currentDrawnLayer = null;
let addSiteDrawnLayer = null;

function getCookie(name) {
  return document.cookie
    .split("; ")
    .find(row => row.startsWith(name + "="))
    ?.split("=")[1];
}



// -------------------------
// Toast notifications
// -------------------------
function showToast(message, type = "success", duration = 3000) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toastEl = document.createElement("div");
  toastEl.id = `toast-${Date.now()}`;
  toastEl.className = `toast align-items-center text-bg-${type} border-0`;
  toastEl.setAttribute("role", "alert");
  toastEl.setAttribute("aria-live", "assertive");
  toastEl.setAttribute("aria-atomic", "true");

  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;

  container.appendChild(toastEl);

  const toast = new bootstrap.Toast(toastEl, { delay: duration });
  toast.show();

  toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
}

async function fetchPostcodeLatLon(postcode) {
    try {
        const response = await fetch(`https://postcodes.t2k.group/postcode/${encodeURIComponent(postcode)}`);

        if (!response.ok) throw new Error("Postcode lookup failed");

        return await response.json();
    } catch (err) {
        console.error(err);
        showToast("Postcode lookup failed", "danger");
        return null;
    }
}

async function fetchSitesWithAuth() {
    const token = getCookie("session_id");

    if (!token) {
        console.error("No session_id cookie found");
        return;
    }

    try {
        const response = await fetch("https://atlasapi.t2k.group/fetch/sites", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data;

    } catch (err) {
        console.error("Error fetching sites:", err);
    }
}

function getPolygonCentroid(points) {
    if (!points || points.length === 0) return { lat: "", lon: "" };

    let latSum = 0;
    let lonSum = 0;

    points.forEach(p => {
        latSum += p.lat;
        lonSum += p.lon;
    });

    return {
        lat: latSum / points.length,
        lon: lonSum / points.length
    };
}

function exportOrgSitesToCSV(org) {

    const rows = [
        ["Name", "Address", "Postcode", "Latitude", "Longitude"]
    ];

    org.sites.forEach(site => {

        const centroid = getPolygonCentroid(site.polygon_points);

        rows.push([
            site.name || "",
            site.address || "",
            site.postcode || "",
            centroid.lat,
            centroid.lon
        ]);
    });

    const csvContent = rows
        .map(row => row.map(value =>
            `"${String(value).replace(/"/g, '""')}"`
        ).join(","))
        .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${org.org_name.replace(/\s+/g, "_")}_sites.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderSitesTable(apiResponse) {
    const container = document.getElementById("sites-table-container");
    if (!container) return;

    container.innerHTML = "";

    const data = apiResponse.data;

    for (const orgId in data) {
        if (!data.hasOwnProperty(orgId)) continue;

        const org = data[orgId];

        const heading = document.createElement("h4");
        heading.textContent = org.org_name;
        heading.style.marginTop = "20px";
        container.appendChild(heading);

        // Add Site button
        const addBtn = document.createElement("button");
        addBtn.className = "btn btn-sm btn-primary mb-2";
        addBtn.textContent = "Add Site";

        addBtn.addEventListener("click", () => {
            openAddSiteModal(orgId, org.org_name);
        });

        container.appendChild(addBtn);

        const exportBtn = document.createElement("button");
        exportBtn.className = "btn btn-sm btn-outline-secondary mb-2 ms-2";
        exportBtn.textContent = "Export CSV";

        exportBtn.addEventListener("click", () => {
            exportOrgSitesToCSV(org);
        });

        container.appendChild(exportBtn);

        const table = document.createElement("table");
        table.className = "table table-hover";
        table.style.width = "100%";

        table.innerHTML = `
            <thead>
                <tr>
                    <th>Site Name</th>
                    <th>Status</th>
                    <th style="width:80px;">Edit</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector("tbody");

        org.sites.forEach(site => {

            const tr = document.createElement("tr");

            const statusBadge = site.active
                ? `<span class="badge bg-success">Active</span>`
                : `<span class="badge bg-secondary">Inactive</span>`;

            tr.innerHTML = `
                <td>${site.name}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary edit-btn">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                </td>
            `;

            const dropdownRow = document.createElement("tr");
            dropdownRow.style.display = "none";

            const dropdownCell = document.createElement("td");
            dropdownCell.colSpan = 3;
            const toggleBtnLabel = site.active ? "Deactivate" : "Activate";
            const toggleBtnClass = site.active ? "btn-danger" : "btn-success";
            dropdownCell.innerHTML = `
                <div style="padding:15px; background:#f8f9fa;">
                    <div class="mb-2">
                        <label>Name</label>
                        <input type="text" class="form-control site-name" value="${site.name}">
                    </div>
                    <div class="mb-2">
                        <label>Address</label>
                        <input type="text" class="form-control site-address" value="${site.address || ''}">
                    </div>
                    <div class="mb-2">
                        <label>Postcode</label>
                        <div class="input-group">
                            <input type="text" class="form-control site-postcode" value="${site.postcode || ''}">
                            <button class="btn btn-outline-secondary postcode-search-btn" type="button">
                                Search
                            </button>
                        </div>
                    </div>
                    <div id="map-${site.id}" style="height:400px;"></div>

                    <div class="mt-3 d-flex gap-3 align-items-center">
                        <button class="btn btn-success save-btn">Save</button>
                        <button class="btn ${toggleBtnClass} toggle-active-btn">
                            ${toggleBtnLabel}
                        </button>
                        <button class="btn delete-btn">
                            Delete
                        </button>

                    </div>
                </div>
            `;


            dropdownRow.appendChild(dropdownCell);

            tr.querySelector(".edit-btn").addEventListener("click", () => {

                const isVisible = dropdownRow.style.display === "table-row";

                // Close other open editors
                document.querySelectorAll(".site-dropdown-row").forEach(row => {
                    row.style.display = "none";
                });

                if (isVisible) {
                    dropdownRow.style.display = "none";
                    return;
                }

                dropdownRow.style.display = "table-row";
                dropdownRow.classList.add("site-dropdown-row");

                setTimeout(() => {
                    initMapEditor(site);
                }, 100);
            });

            tbody.appendChild(tr);
            tbody.appendChild(dropdownRow);
        });

        container.appendChild(table);
    }



}

async function initSites() {
    const sitesData = await fetchSitesWithAuth();
    renderSitesTable(sitesData);
}

function initMapEditor(site) {

    const mapId = `map-${site.id}`;
    if (document.getElementById(mapId)._leaflet_id) return;

    const map = L.map(mapId).setView([51.5080, -0.1281], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    }).addTo(map);

    // Leaflet Draw setup
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
        draw: {
            polygon: true,
            polyline: false,
            rectangle: false,
            circle: false,
            circlemarker: false,
            marker: false
        },
        edit: {
            featureGroup: drawnItems,
            remove: true
        }
    });

    map.addControl(drawControl);

    // Load existing polygon if present
    if (site.polygon_points && site.polygon_points.length >= 3) {
        const latlngs = site.polygon_points.map(p => [p.lat, p.lon]);
        currentDrawnLayer = L.polygon(latlngs, { color: "blue", fillOpacity: 0.2 }).addTo(drawnItems);
        map.fitBounds(currentDrawnLayer.getBounds());
    }

    map.on(L.Draw.Event.CREATED, function (e) {
        if (currentDrawnLayer) drawnItems.removeLayer(currentDrawnLayer);

        const layer = e.layer;
        currentDrawnLayer = layer;
        drawnItems.addLayer(layer);
    });

    map.on(L.Draw.Event.EDITED, function (e) {
        // Only one layer, keep track
        currentDrawnLayer = e.layers.getLayers()[0] || currentDrawnLayer;
    });

    map.on(L.Draw.Event.DELETED, function (e) {
        currentDrawnLayer = null;
    });

    const container = document.getElementById(mapId).closest("td");
    const saveBtn = container.querySelector(".save-btn");
    const toggleBtn = container.querySelector(".toggle-active-btn");
    const deleteBtn = container.querySelector(".delete-btn")

    const nameInput = container.querySelector(".site-name");
    const addressInput = container.querySelector(".site-address");
    const postcodeInput = container.querySelector(".site-postcode")
    
    const postcodeSearchBtn = container.querySelector(".postcode-search-btn");
    let postcodeMarker = null;

    postcodeSearchBtn.addEventListener("click", async () => {

        const postcode = postcodeInput.value.trim();
        if (!postcode) return;

        const result = await fetchPostcodeLatLon(postcode);
        if (!result) return;

        const { latitude, longitude } = result;

        map.setView([latitude, longitude], 17);

        if (postcodeMarker) {
            map.removeLayer(postcodeMarker);
        }

        postcodeMarker = L.marker([latitude, longitude]).addTo(map);
    });

    // Save button
    saveBtn.addEventListener("click", async () => {

        if (!currentDrawnLayer) {
            alert("Please draw a polygon before saving.");
            return;
        }

        const latlngs = currentDrawnLayer.getLatLngs()[0].map(p => ({ lat: p.lat, lon: p.lng }));

        const updatedData = {
            name: nameInput.value,
            address: addressInput.value,
            postcode: postcodeInput.value,
            polygon_points: latlngs,
            active: site.active
        };

        try {
            const token = getCookie("session_id");

            const response = await fetch("https://atlasapi.t2k.group/update/sites", {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ [site.id]: updatedData })
            });

            const result = await response.json();
            if (!response.ok || !result.status) throw new Error(result.message || "Update failed");

            showToast("Site updated successfully", "success");
            site.name = updatedData.name;
            site.address = updatedData.address;
            site.postcode = updatedData.postcode;
            container.closest("tr").previousElementSibling.querySelector("td").textContent = updatedData.name;

        } catch (err) {
            console.error("Update failed:", err);
            showToast("Error updating site", "danger");
        }
    });

    // Toggle active button (unchanged)
    toggleBtn.addEventListener("click", async () => {
        const newActiveState = site.active ? 0 : 1;

        try {
            const token = getCookie("session_id");

            const response = await fetch("https://atlasapi.t2k.group/update/sites", {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    [site.id]: {
                        name: nameInput.value,
                        address: addressInput.value,
                        postcode: postcodeInput.value,
                        polygon_points: currentDrawnLayer
                            ? currentDrawnLayer.getLatLngs()[0].map(p => ({ lat: p.lat, lon: p.lng }))
                            : null,
                        active: newActiveState
                    }
                })
            });

            const result = await response.json();
            if (!response.ok || !result.status) throw new Error(result.message || "Update failed");

            site.active = newActiveState;
            const row = container.closest("tr").previousElementSibling;
            row.querySelector("td:nth-child(2)").innerHTML =
                newActiveState ? `<span class="badge bg-success">Active</span>` : `<span class="badge bg-secondary">Inactive</span>`;
            toggleBtn.textContent = newActiveState ? "Deactivate" : "Activate";
            toggleBtn.classList.remove("btn-danger", "btn-success");
            toggleBtn.classList.add(newActiveState ? "btn-danger" : "btn-success");

            showToast(`Site ${newActiveState ? "activated" : "deactivated"} successfully`, "success");

        } catch (err) {
            console.error("Toggle failed:", err);
            showToast("Error toggling site status", "danger");
        }
    });

    deleteBtn.addEventListener("click", async () => {

        try {
            const token = getCookie("session_id");

            const response = await fetch(`https://atlasapi.t2k.group/delete/site?siteId=${site.id}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
            });

            const result = await response.json();
            if (!response.ok || !result.status) throw new Error(result.message || "Update failed");
            
            showToast("Site Deleted Sucessfully")
            initSites()

        }
         catch (err) {
        console.error("Delete failed:", err);
        showToast("Error Deleting site")
    }

    });


    setTimeout(() => map.invalidateSize(), 200);
}

function openAddSiteModal(orgId, orgName) {

    document.getElementById("new-site-org-id").value = orgId;

    document.querySelector("#addSiteModal .modal-title").textContent =
        `Add Site - ${orgName}`;

    const modalEl = document.getElementById("addSiteModal");
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    // Initialize map when modal is fully shown
    modalEl.addEventListener("shown.bs.modal", () => {

        addSiteMap = L.map("new-site-map").setView([51.5080, -0.1281], 15);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(addSiteMap);

        const drawnItems = new L.FeatureGroup();
        addSiteMap.addLayer(drawnItems);

        const drawControl = new L.Control.Draw({
            draw: { polygon: true, polyline: false, rectangle: false, circle: false, circlemarker: false, marker: false },
            edit: { featureGroup: drawnItems }
        });
        addSiteMap.addControl(drawControl);

        addSiteMap.on(L.Draw.Event.CREATED, function(e) {
            if (addSiteDrawnLayer) drawnItems.removeLayer(addSiteDrawnLayer);
            addSiteDrawnLayer = e.layer;
            drawnItems.addLayer(addSiteDrawnLayer);
        });

        addSiteMap.on(L.Draw.Event.EDITED, function(e) {
            addSiteDrawnLayer = e.layers.getLayers()[0] || addSiteDrawnLayer;
        });

        addSiteMap.on(L.Draw.Event.DELETED, function(e) {
            addSiteDrawnLayer = null;
        });

        const postcodeInput = document.getElementById("new-site-postcode");
        const postcodeSearchBtn = document.getElementById("new-site-postcode-search");
        let postcodeMarker = null;

        postcodeSearchBtn.addEventListener("click", async () => {

            const postcode = postcodeInput.value.trim();
            if (!postcode) return;

            const result = await fetchPostcodeLatLon(postcode);
            if (!result) return;

            const { latitude, longitude } = result;

            addSiteMap.setView([latitude, longitude], 17);

            if (postcodeMarker) {
                addSiteMap.removeLayer(postcodeMarker);
            }

            postcodeMarker = L.marker([latitude, longitude]).addTo(addSiteMap);
        });

        setTimeout(() => addSiteMap.invalidateSize(), 200);
    });

}


document.getElementById("create-site-btn").addEventListener("click", async () => {
    const orgId = document.getElementById("new-site-org-id").value;
    const name = document.getElementById("new-site-name").value;
    const address = document.getElementById("new-site-address").value;
    const postcode = document.getElementById("new-site-postcode").value;
    const active = document.getElementById("new-site-active").checked ? 1 : 0;

    if (!name || !address || !postcode) {
        alert("Please enter site name, address, and postcode");
        return;
    }

    if (!addSiteDrawnLayer) {
        alert("Please draw a polygon for the site location before creating.");
        return;
    }

    const polygon_points = addSiteDrawnLayer.getLatLngs()[0].map(p => ({ lat: p.lat, lon: p.lng }));

    const payload = {
        org_id: parseInt(orgId),
        name: name,
        address: address,
        postcode: postcode,
        polygon_points: polygon_points,
        active: active
    };

    try {
        const token = getCookie("session_id");

        const response = await fetch("https://atlasapi.t2k.group/create/sites", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok || !result.status) {
            throw new Error(result.message || "Creation failed");
        }

        showToast("Site created successfully", "success");
        location.reload();

    } catch (err) {
        console.error(err);
        showToast("Error creating site", "danger");
    }
});



initSites();