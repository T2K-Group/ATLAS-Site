let addSiteMap, addSiteMarker, addSiteCircle;

async function fetchSitesWithAuth() {
    // Helper to read cookies
    function getCookie(name) {
        return document.cookie
            .split("; ")
            .find(row => row.startsWith(name + "="))
            ?.split("=")[1];
    }

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
                        <input type="text" class="form-control site-postcode" value="${site.postcode || ''}">
                    </div>
                    <div id="map-${site.id}" style="height:400px;"></div>

                    <div class="mt-3 d-flex gap-3 align-items-center">
                        <label>Radius (m):</label>
                        <input type="number" class="form-control radius-input" value="${site.radius}" style="width:120px;">
                        <button class="btn btn-success save-btn">Save</button>
                        <button class="btn ${toggleBtnClass} toggle-active-btn">
                            ${toggleBtnLabel}
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

    const defaultLat = 51.5080; // Trafalgar Square
    const defaultLon = -0.1281;

    const lat = site.lat || defaultLat;  // fallback coords
    const lng = site.lon || defaultLon;

    const map = L.map(mapId).setView([lat, lng], 15);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors"
    }).addTo(map);

    const marker = L.marker([lat, lng], { draggable: true }).addTo(map);

    let circle = L.circle([lat, lng], {
        radius: site.radius,
        color: "blue",
        fillOpacity: 0.2
    }).addTo(map);

    // Update circle when marker moves
    marker.on("drag", function (e) {
        circle.setLatLng(e.latlng);
    });

    const container = document.getElementById(mapId).closest("td");
    const radiusInput = container.querySelector(".radius-input");
    const saveBtn = container.querySelector(".save-btn");
    const toggleBtn = container.querySelector(".toggle-active-btn");

    // Grab new text inputs
    const nameInput = container.querySelector(".site-name");
    const addressInput = container.querySelector(".site-address");
    const postcodeInput = container.querySelector(".site-postcode");

    // Live radius update
    radiusInput.addEventListener("input", () => {
        const newRadius = parseInt(radiusInput.value) || 0;
        circle.setRadius(newRadius);
    });

    // Save button
    saveBtn.addEventListener("click", async () => {

        const updatedData = {
            name: nameInput.value,
            address: addressInput.value,
            postcode: postcodeInput.value,
            lat: marker.getLatLng().lat,
            lon: marker.getLatLng().lng,
            radius: parseFloat(radiusInput.value),
            active: site.active
        };

        try {
            const token = document.cookie
                .split("; ")
                .find(row => row.startsWith("session_id="))
                ?.split("=")[1];

            const response = await fetch("https://atlasapi.t2k.group/update/sites", {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    [site.id]: updatedData
                })
            });

            const result = await response.json();

            if (!response.ok || !result.status) {
                throw new Error(result.message || "Update failed");
            }

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

    toggleBtn.addEventListener("click", async () => {

        const newActiveState = site.active ? 0 : 1;
        const actionText = newActiveState ? "activate" : "deactivate";

        try {
            const token = document.cookie
                .split("; ")
                .find(row => row.startsWith("session_id="))
                ?.split("=")[1];

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
                        lat: marker.getLatLng().lat,
                        lon: marker.getLatLng().lng,
                        radius: parseFloat(radiusInput.value),
                        active: newActiveState
                    }
                })
            });

            const result = await response.json();

            if (!response.ok || !result.status) {
                throw new Error(result.message || "Update failed");
            }

            // Update local state
            site.active = newActiveState;

            // Update status badge
            const row = container.closest("tr").previousElementSibling;
            row.querySelector("td:nth-child(2)").innerHTML =
                newActiveState
                    ? `<span class="badge bg-success">Active</span>`
                    : `<span class="badge bg-secondary">Inactive</span>`;

            // Swap button appearance
            toggleBtn.textContent = newActiveState ? "Deactivate" : "Activate";
            toggleBtn.classList.remove("btn-danger", "btn-success");
            toggleBtn.classList.add(newActiveState ? "btn-danger" : "btn-success");

            showToast(`Site ${newActiveState ? "activated" : "deactivated"} successfully`, "success");

        } catch (err) {
            console.error("Toggle failed:", err);
            showToast("Error toggling site status", "danger");
        }
    });


    setTimeout(() => {
        map.invalidateSize();
    }, 200);
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

        const radiusInput = document.getElementById("new-site-radius");
        const mapDiv = document.getElementById("new-site-map");

        if (!mapDiv || !radiusInput) {
            console.error("Add site modal map or radius input not found");
            return;
        }

        const defaultLat = 51.5080; // Trafalgar Square
        const defaultLon = -0.1281;
        const radius = parseFloat(radiusInput.value) || 100;

        // Remove previous map if exists
        if (addSiteMap) {
            addSiteMap.remove();
        }

        addSiteMap = L.map("new-site-map").setView([defaultLat, defaultLon], 15);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap contributors"
        }).addTo(addSiteMap);

        addSiteMarker = L.marker([defaultLat, defaultLon], { draggable: true }).addTo(addSiteMap);

        addSiteCircle = L.circle([defaultLat, defaultLon], {
            radius: radius,
            color: "blue",
            fillOpacity: 0.2
        }).addTo(addSiteMap);

        // Update circle when marker moves
        addSiteMarker.on("drag", (e) => {
            addSiteCircle.setLatLng(e.latlng);
        });

        // Update circle radius live
        radiusInput.addEventListener("input", () => {
            addSiteCircle.setRadius(parseFloat(radiusInput.value) || 0);
        });

        // Ensure map renders correctly
        setTimeout(() => addSiteMap.invalidateSize(), 200);

    }, { once: true });
}


document.getElementById("create-site-btn").addEventListener("click", async () => {

    const orgId = document.getElementById("new-site-org-id").value;
    const name = document.getElementById("new-site-name").value;
    const address = document.getElementById("new-site-address").value;
    const postcode = document.getElementById("new-site-postcode").value;
    const radius = parseFloat(document.getElementById("new-site-radius").value) || 100;
    const active = document.getElementById("new-site-active").checked ? 1 : 0;

    if (!name || !address || !postcode) {
        alert("Please enter site name, address, and postcode");
        return;
    }

    const payload = {
        org_id: parseInt(orgId),
        name: name,
        address: address,
        postcode: postcode,      // <-- new field
        lat: addSiteMarker.getLatLng().lat,
        lon: addSiteMarker.getLatLng().lng,
        radius: radius,
        active: active
    };

    try {
        const token = document.cookie
            .split("; ")
            .find(row => row.startsWith("session_id="))
            ?.split("=")[1];

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


function showToast(message, type = "success", duration = 3000) {
    // type: "success", "danger", "info", "warning"
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toastId = `toast-${Date.now()}`;

    const toastEl = document.createElement("div");
    toastEl.id = toastId;
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

    // Remove from DOM when hidden
    toastEl.addEventListener("hidden.bs.toast", () => {
        toastEl.remove();
    });
}

initSites();