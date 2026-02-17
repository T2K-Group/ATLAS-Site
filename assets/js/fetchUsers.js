/* ----------------------------------------------------
   Authenticated fetch for users
---------------------------------------------------- */
async function fetchUsersWithAuth() {
  function getCookie(name) {
    return document.cookie
      .split("; ")
      .find(row => row.startsWith(name + "="))
      ?.split("=")[1];
  }

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
   Bulk update helper
---------------------------------------------------- */
async function updateUsersBulk(updates) {
  function getCookie(name) {
    return document.cookie
      .split("; ")
      .find(row => row.startsWith(name + "="))
      ?.split("=")[1];
  }

  const token = getCookie("session_id");
  if (!token) return false;

  const response = await fetch("https://atlasapi.t2k.group/update/users", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(updates)
  });

  const result = await response.json();
  return result?.status === true;
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
        <td class="d-none d-md-table-cell">${user.email}</td>
        <td class="d-none d-md-table-cell">
          <span class="badge ${roleInfo.badge}">${roleInfo.label}</span>
        </td>
        <td>
          <span class="badge ${isActive ? "bg-success" : "bg-secondary"}">
            ${isActive ? "Active" : "Inactive"}
          </span>
        </td>
        <td class="text-end">
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
   Delegated edit modal handling
---------------------------------------------------- */
document.getElementById("users-table-container").addEventListener("click", async e => {
  const btn = e.target.closest(".edit-btn");
  if (!btn) return;

  const tr = btn.closest("tr");
  const userId = tr.dataset.userid;
  const user = window.currentUsers[userId];
  if (!user) return;

  const modal = document.getElementById("edit-user-modal");
  const nameInput = document.getElementById("edit-name");
  const roleSelect = document.getElementById("edit-role");
  const saveBtn = document.getElementById("edit-save");
  const cancelBtn = document.getElementById("edit-cancel");

  nameInput.value = user.name;
  roleSelect.value = user.role;
  modal.hidden = false;

  const close = () => {
    modal.hidden = true;
    saveBtn.onclick = null;
  };
  cancelBtn.onclick = close;

  saveBtn.onclick = async () => {
    const updates = {};
    updates[user.userId] = {};

    const newName = nameInput.value.trim();
    const newRole = parseInt(roleSelect.value, 10);

    if (newName !== user.name) updates[user.userId].name = newName;
    if (newRole !== user.role) updates[user.userId].role = newRole;

    if (!Object.keys(updates[user.userId]).length) {
      close();
      return;
    }

    const success = await updateUsersBulk(updates);
    if (success) {
      initUsers(); // refresh table
      close();
    }
  };
});

/* ----------------------------------------------------
   Initialize
---------------------------------------------------- */
async function initUsers() {
  const usersData = await fetchUsersWithAuth();
  if (usersData?.status) {
    renderUsersTable(usersData);
  }
}

const modal = document.getElementById("edit-user-modal");

function openModal() {
  modal.classList.add("show");
  modal.hidden = false;
}

function closeModal() {
  modal.classList.remove("show");
  modal.hidden = true;
}

// Use these in your delegated click handler:
openModal();   // instead of modal.hidden = false;
closeModal();  // instead of modal.hidden = true;


initUsers();
