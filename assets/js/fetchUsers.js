/* ----------------------------------------------------
   Authenticated fetch for users
---------------------------------------------------- */

function getCookie(name) {
  return document.cookie
    .split("; ")
    .find(row => row.startsWith(name + "="))
    ?.split("=")[1];
}

async function fetchUsersWithAuth() {
  const token = getCookie("session_id");
  if (!token) return null;

  try {
    const response = await fetch("https://atlasapi.t2k.group/fetch/users", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}


/* ----------------------------------------------------
   Role helpers
---------------------------------------------------- */
function getRoleLabel(role) {
  switch (role) {
    case 0: return { label: "Inactive", badge: "bg-secondary" };
    case 1: return { label: "User", badge: "bg-primary" };
    case 2: return { label: "Admin", badge: "bg-warning text-dark" };
    case 3: return { label: "Global Admin", badge: "bg-danger" };
    default: return { label: "Unknown", badge: "bg-dark" };
  }
}

/* ----------------------------------------------------
   Render users table
---------------------------------------------------- */
window.currentUsers = {}; // global lookup

function renderUsersTable(apiResponse) {
  const container = document.getElementById("users-table-container");
  if (!container) return;

  container.innerHTML = "";
  const data = apiResponse.data;
  window.currentUsers = {}; // reset

  for (const orgId in data) {
    if (!Object.prototype.hasOwnProperty.call(data, orgId)) continue;

    const org = data[orgId];
    const heading = document.createElement("h4");
    heading.textContent = org.orgName;
    heading.style.marginTop = "20px";
    container.appendChild(heading);

    const table = document.createElement("table");
    table.className = "table table-striped table-hover";
    table.innerHTML = `
      <thead>
        <tr>
          <th>Name</th>
          <th class="d-none d-md-table-cell">Email</th>
          <th class="d-none d-md-table-cell">Role</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");

    if (!org.users || org.users.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-muted">No users found</td>
        </tr>
      `;
    }

    org.users.forEach(user => {
      const tr = document.createElement("tr");
      tr.dataset.userid = user.userId; // for delegation
      window.currentUsers[user.userId] = user;

      const roleInfo = getRoleLabel(user.role);
      const isActive = user.role !== 0;

      tr.innerHTML = `
      <td>
        <div class="fw-semibold">${user.name}</div>
        <div class="d-md-none mt-1">
          <span class="badge ${roleInfo.badge}">${roleInfo.label}</span>
        </div>
      </td>
    
      <td class="d-none d-md-table-cell">
        ${user.email}
      </td>
    
      <td class="d-none d-md-table-cell role-cell">
        <span class="badge ${roleInfo.badge} role-badge">
          ${roleInfo.label}
        </span>
      </td>
    
      <td class="status-cell">
        <span class="status-pill ${isActive ? "active" : "inactive"}">
          ${isActive ? "Active" : "Inactive"}
        </span>
      </td>
    
      <td class="text-end actions-cell">
        <button class="btn btn-sm btn-outline-primary edit-btn">
          <i class="fa-solid fa-pencil"></i>
        </button>
      </td>
    `;
    
      tbody.appendChild(tr);
    });

    container.appendChild(table);
  }
}
/* ----------------------------------------------------
   Edit / Save / Discard Logic (Bulk-ready format)
---------------------------------------------------- */

document.addEventListener("click", async function (e) {
  const editBtn = e.target.closest(".edit-btn");
  const saveBtn = e.target.closest(".save-btn");
  const discardBtn = e.target.closest(".discard-btn");

  if (!editBtn && !saveBtn && !discardBtn) return;

  const row = e.target.closest("tr");
  const userId = row?.dataset.userid;
  const user = window.currentUsers[userId];
  if (!row || !user) return;

  const roleCell = row.querySelector(".role-cell");
  const actionsCell = row.querySelector(".actions-cell");

  /* -------------------- EDIT -------------------- */
  if (editBtn) {

    // Block role 3 (Global Admin)
    if (user.role === 3) return;

    row.classList.add("editing-row");

    roleCell.innerHTML = `
      <select class="form-select form-select-sm role-select">
        <option value="0" ${user.role === 0 ? "selected" : ""}>Inactive</option>
        <option value="1" ${user.role === 1 ? "selected" : ""}>User</option>
        <option value="2" ${user.role === 2 ? "selected" : ""}>Admin</option>
      </select>
    `;

    console.log("roleCell:", roleCell);


    actionsCell.innerHTML = `
      <button class="btn btn-sm btn-success save-btn me-1">
        <i class="fa-solid fa-check"></i>
      </button>
      <button class="btn btn-sm btn-outline-secondary discard-btn">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;
  }

  /* -------------------- SAVE -------------------- */
  if (saveBtn) {
    const select = row.querySelector(".role-select");
    const newRole = parseInt(select.value);

    const payload = {
      [user.userId]: {
        name: user.name,
        role: newRole
      }
    };

    saveBtn.disabled = true;

    const success = await updateUsersBulk(payload);

    if (!success) {
      alert("Failed to update user.");
      saveBtn.disabled = false;
      return;
    }

    // Update local state
    user.role = newRole;

    const roleInfo = getRoleLabel(newRole);

    roleCell.innerHTML = `
      <span class="badge ${roleInfo.badge} role-badge">
      
        ${roleInfo.label}
      </span>
    `;

    actionsCell.innerHTML = `
      <button class="btn btn-sm btn-outline-primary edit-btn">
        <i class="fa-solid fa-pencil"></i>
      </button>
    `;
    initUsers()
    row.classList.remove("editing-row");
    
  }

  /* -------------------- DISCARD -------------------- */
  if (discardBtn) {

    const roleInfo = getRoleLabel(user.role);

    roleCell.innerHTML = `
      <span class="badge ${roleInfo.badge} role-badge">
        ${roleInfo.label}
      </span>
    `;

    actionsCell.innerHTML = `
      <button class="btn btn-sm btn-outline-primary edit-btn">
        <i class="fa-solid fa-pencil"></i>
      </button>
    `;

    row.classList.remove("editing-row");
  }
});

async function updateUsersBulk(updatesObject) {
  const token = getCookie("session_id");
  if (!token) return false;

  try {
    const response = await fetch("https://atlasapi.t2k.group/update/users", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(updatesObject)
    });

    if (!response.ok) return false;

    const result = await response.json();
    return result?.status === true;
  } catch {
    return false;
  }
}



/* ----------------------------------------------------
   Initialize
---------------------------------------------------- */
async function initUsers() {
  const usersData = await fetchUsersWithAuth();
  if (usersData?.status) {
    renderUsersTable(usersData);
  }
}


initUsers()