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

    container.innerHTML = ""; // clear previous render

    const data = apiResponse.data;

    for (const orgId in data) {
        if (!data.hasOwnProperty(orgId)) continue;

        const org = data[orgId];

        // Org heading
        const heading = document.createElement("h4");
        heading.textContent = org.org_name;
        heading.style.marginTop = "20px";
        container.appendChild(heading);

        // Table
        const table = document.createElement("table");
        table.className = "table table-striped table-hover";
        table.style.width = "100%";

        table.innerHTML = `
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Address</th>
                    <th>HQ</th>
                    <th>Radius (m)</th>
                    <th>Status</th>
                    <th>Actions</th>
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

            const toggleButton = site.active
                ? `<button class="btn btn-sm btn-danger deactivate-btn">Deactivate</button>`
                : `<button class="btn btn-sm btn-success activate-btn">Activate</button>`;

            tr.innerHTML = `
                <td>${site.name}</td>
                <td>${site.address}</td>
                <td>${site.hq ? "Yes" : "No"}</td>
                <td>${site.radius}</td>
                <td>${statusBadge}</td>
                <td class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-primary edit-btn">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    ${toggleButton}
                </td>
            `;

            // Wire actions
            tr.querySelector(".edit-btn").addEventListener("click", () => {
                console.log("Edit site:", site);
            });

            const activateBtn = tr.querySelector(".activate-btn");
            if (activateBtn) {
                activateBtn.addEventListener("click", () => {
                    console.log("Activate site:", site);
                });
            }

            const deactivateBtn = tr.querySelector(".deactivate-btn");
            if (deactivateBtn) {
                deactivateBtn.addEventListener("click", () => {
                    console.log("Deactivate site:", site);
                });
            }

            tbody.appendChild(tr);
        });

        container.appendChild(table);
    }
}


async function initSites() {
    const sitesData = await fetchSitesWithAuth();
    renderSitesTable(sitesData);
}

initSites();