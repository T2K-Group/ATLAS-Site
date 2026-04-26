async function fetchAnchorsWithAuth() {
    const token = getCookie("session_id");

    if (!token) {
        console.error("No session_id cookie found");
        return;
    }

    try {
        const response = await fetch("https://atlasapi.t2k.group/fetch/anchors", {
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
        console.error("Error fetching anchors:", err);
    }
}

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


function renderAnchorsTable(apiResponse) {
    const container = document.getElementById("anchors-table-container");
    if (!container) return;

    container.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h4 class="mb-0">Anchors</h4>
            <button class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#addAnchorModal">
                <i class="fa-solid fa-plus me-1"></i> New Anchor
            </button>
        </div>
    `;

    const anchors = Array.isArray(apiResponse.data) ? apiResponse.data : [];

    const table = document.createElement("table");
    table.className = "table table-hover";
    table.style.width = "100%";

    table.innerHTML = `
        <thead>
            <tr>
                <th>ID</th>
                <th>MAC Address</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Site ID</th>
                <th>Status</th>
                <th style="width:80px;">Edit</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    if (anchors.length === 0) {
        table.querySelector("tbody").innerHTML = `
            <tr><td colspan="7" class="text-center text-muted py-3">No anchors found.</td></tr>
        `;
        container.appendChild(table);
        return;
    }

    const tbody = table.querySelector("tbody");

    anchors.forEach(anchor => {
        const tr = document.createElement("tr");

        const statusBadge = anchor.active
            ? `<span class="badge bg-success">Active</span>`
            : `<span class="badge bg-secondary">Inactive</span>`;

        tr.innerHTML = `
            <td>${anchor.id}</td>
            <td>${anchor.mac || ""}</td>
            <td>${anchor.lat ?? ""}</td>
            <td>${anchor.lon ?? ""}</td>
            <td>${anchor.site_id ?? ""}</td>
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
        dropdownCell.colSpan = 7;

        const toggleBtnLabel = anchor.active ? "Deactivate" : "Activate";
        const toggleBtnClass = anchor.active ? "btn-danger" : "btn-success";

        dropdownCell.innerHTML = `
            <div style="padding:15px; background:#f8f9fa;">
                <div class="row g-2 mb-2">
                    <div class="col-md-4">
                        <label>MAC Address</label>
                        <input type="text" class="form-control anchor-mac" value="${anchor.mac || ""}">
                    </div>
                    <div class="col-md-2">
                        <label>Latitude</label>
                        <input type="number" step="any" class="form-control anchor-lat" value="${anchor.lat ?? ""}">
                    </div>
                    <div class="col-md-2">
                        <label>Longitude</label>
                        <input type="number" step="any" class="form-control anchor-lon" value="${anchor.lon ?? ""}">
                    </div>
                    <div class="col-md-2">
                        <label>Site ID</label>
                        <input type="number" class="form-control anchor-site-id" value="${anchor.site_id ?? ""}">
                    </div>
                </div>
                <div class="mt-3 d-flex gap-3 align-items-center">
                    <button class="btn btn-success save-btn">Save</button>
                    <button class="btn ${toggleBtnClass} toggle-active-btn">${toggleBtnLabel}</button>
                    <button class="btn btn-outline-danger delete-btn">Delete</button>
                </div>
            </div>
        `;

        dropdownRow.appendChild(dropdownCell);

        tr.querySelector(".edit-btn").addEventListener("click", () => {
            const isVisible = dropdownRow.style.display === "table-row";

            document.querySelectorAll(".anchor-dropdown-row").forEach(row => {
                row.style.display = "none";
            });

            if (isVisible) {
                dropdownRow.style.display = "none";
                return;
            }

            dropdownRow.style.display = "table-row";
            dropdownRow.classList.add("anchor-dropdown-row");
        });

        const macInput = dropdownCell.querySelector(".anchor-mac");
        const saveBtn = dropdownCell.querySelector(".save-btn");
        const toggleBtn = dropdownCell.querySelector(".toggle-active-btn");
        const deleteBtn = dropdownCell.querySelector(".delete-btn");

        saveBtn.addEventListener("click", async () => {
            const latVal = dropdownCell.querySelector(".anchor-lat").value;
            const lonVal = dropdownCell.querySelector(".anchor-lon").value;
            const siteVal = dropdownCell.querySelector(".anchor-site-id").value;
            const payload = {
                mac: macInput.value.trim() || null,
                lat: !isNaN(latVal) ? latVal : null,
                lon: !isNaN(lonVal) ? lonVal : null,
                site_id: !isNaN(siteVal) ? siteVal : null
            };

            try {
                const token = getCookie("session_id");

                const response = await fetch(`https://atlasapi.t2k.group/update/anchor/${anchor.id}`, {
                    method: "PATCH",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();
                if (!response.ok || !result.status) throw new Error(result.message || "Update failed");

                showToast("Anchor updated successfully", "success");
                initAnchors();

            } catch (err) {
                console.error("Update failed:", err);
                showToast("Error updating anchor", "danger");
            }
        });

        toggleBtn.addEventListener("click", async () => {
            const newActiveState = anchor.active ? 0 : 1;

            try {
                const token = getCookie("session_id");

                const response = await fetch(`https://atlasapi.t2k.group/update/anchor/${anchor.id}`, {
                    method: "PATCH",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ active: newActiveState })
                });

                const result = await response.json();
                if (!response.ok || !result.status) throw new Error(result.message || "Update failed");

                showToast(`Anchor ${newActiveState ? "activated" : "deactivated"} successfully`, "success");
                initAnchors();

            } catch (err) {
                console.error("Toggle failed:", err);
                showToast("Error toggling anchor status", "danger");
            }
        });

        deleteBtn.addEventListener("click", async () => {
            try {
                const token = getCookie("session_id");

                const response = await fetch(`https://atlasapi.t2k.group/delete/anchor/${anchor.id}`, {
                    method: "DELETE",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json"
                    }
                });

                const result = await response.json();
                if (!response.ok || !result.status) throw new Error(result.message || "Deletion failed");

                showToast("Anchor deleted successfully", "success");
                initAnchors();

            } catch (err) {
                console.error("Delete failed:", err);
                showToast("Error deleting anchor", "danger");
            }
        });

        tbody.appendChild(tr);
        tbody.appendChild(dropdownRow);
    });

    container.appendChild(table);
}

async function initAnchors() {
    const anchorsData = await fetchAnchorsWithAuth();
    renderAnchorsTable(anchorsData || { data: [] });
}

document.getElementById("create-anchor-btn").addEventListener("click", async () => {
    const mac = document.getElementById("new-anchor-mac").value.trim() || null;
    const siteId = document.getElementById("new-anchor-site-id").value;
    const lat = document.getElementById("new-anchor-lat").value;
    const lon = document.getElementById("new-anchor-lon").value;
    const active = document.getElementById("new-anchor-active").checked ? 1 : 0;

    const payload = {
        mac,
        site_id: siteId !== "" ? parseInt(siteId) : null,
        lat: lat !== "" ? parseFloat(lat) : null,
        lon: lon !== "" ? parseFloat(lon) : null,
        active
    };

    try {
        const token = getCookie("session_id");

        const response = await fetch("https://atlasapi.t2k.group/create/anchor", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok || !result.status) throw new Error(result.message || "Creation failed");

        bootstrap.Modal.getInstance(document.getElementById("addAnchorModal")).hide();
        showToast("Anchor created successfully", "success");
        initAnchors();

    } catch (err) {
        console.error("Create failed:", err);
        showToast("Error creating anchor", "danger");
    }
});

initAnchors();
