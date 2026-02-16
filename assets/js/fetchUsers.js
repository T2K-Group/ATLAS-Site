async function fetchUsersWithAuth() {
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
        const response = await fetch("https://atlasapi.t2k.group/fetch/users", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();

    } catch (err) {
        console.error("Error fetching users:", err);
    }
}

function getRoleLabel(role) {
    switch (role) {
        case 0: return { label: "Inactive", badge: "bg-secondary" };
        case 1: return { label: "User", badge: "bg-primary" };
        case 2: return { label: "Admin", badge: "bg-warning text-dark" };
        case 3: return { label: "Global Admin", badge: "bg-danger" };
        default: return { label: "Unknown", badge: "bg-dark" };
    }
}

function renderUsersTable(apiResponse) {
    const container = document.getElementById("users-table-container");
    if (!container) return;

    container.innerHTML = "";

    const data = apiResponse.data;

    for (const orgId in data) {
        if (!data.hasOwnProperty(orgId)) continue;

        const org = data[orgId];

        // Org Heading
        const heading = document.createElement("h4");
        heading.textContent = org.orgName;
        heading.style.marginTop = "20px";
        container.appendChild(heading);

        const table = document.createElement("table");
        table.className = "table table-striped table-hover";
        table.style.width = "100%";

        table.innerHTML = `
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector("tbody");

        if (!org.users || org.users.length === 0) {
            const emptyRow = document.createElement("tr");
            emptyRow.innerHTML = `
                <td colspan="5" class="text-muted">No users found</td>
            `;
            tbody.appendChild(emptyRow);
        }

        org.users.forEach(user => {
            const tr = document.createElement("tr");

            const roleInfo = getRoleLabel(user.role);
            const isActive = user.role !== 0;

            const roleBadge = `
                <span class="badge ${roleInfo.badge}">
                    ${roleInfo.label}
                </span>
            `;

            const statusBadge = isActive
                ? `<span class="badge bg-success">Active</span>`
                : `<span class="badge bg-secondary">Inactive</span>`;

            const activateButton = !isActive
                ? `<button class="btn btn-sm btn-success activate-btn">Activate</button>`
                : "";

            tr.innerHTML = `
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>${roleBadge}</td>
                <td>${statusBadge}</td>
                <td class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-primary edit-btn">
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    ${activateButton}
                </td>
            `;

            // Edit action
            tr.querySelector(".edit-btn")?.addEventListener("click", () => {
                console.log("Edit user:", user);
            });

            // Activate action
            tr.querySelector(".activate-btn")?.addEventListener("click", () => {
                console.log("Activate user:", user);
            });

            tbody.appendChild(tr);
        });

        container.appendChild(table);
    }
}

async function initUsers() {
    const usersData = await fetchUsersWithAuth();
    if (usersData?.status) {
        renderUsersTable(usersData);
    } else {
        console.error("Invalid response:", usersData);
    }
}

initUsers();
