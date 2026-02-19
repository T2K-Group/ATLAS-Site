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
            dropdownCell.innerHTML = `
                <div style="padding:15px; background:#f8f9fa;">
                    <div id="map-${site.id}" style="height:400px;"></div>

                    <div class="mt-3 d-flex gap-3 align-items-center">
                        <label>Radius (m):</label>
                        <input type="number" class="form-control radius-input" 
                               value="${site.radius}" style="width:120px;">
                        <button class="btn btn-success save-btn">Save</button>
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

    const lat = site.lat || -26.2041;  // fallback coords
    const lng = site.lon || 28.0473;

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

    // Live radius update
    radiusInput.addEventListener("input", () => {
        const newRadius = parseInt(radiusInput.value) || 0;
        circle.setRadius(newRadius);
    });

  // Save button
    saveBtn.addEventListener("click", async () => {

        const updatedData = {
            name: site.name,
            address: site.address,
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

            alert("Site updated successfully");

        } catch (err) {
            console.error("Update failed:", err);
            alert("Error updating site");
        }
    });


    setTimeout(() => {
        map.invalidateSize();
    }, 200);
}


initSites();