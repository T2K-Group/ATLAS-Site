
    function getCookie(name) {
      return document.cookie
        .split("; ")
        .find(row => row.startsWith(name + "="))
        ?.split("=")[1];
    }

(async function checkAuth() {
    //console.info("check auth running");

    const sessionId = getCookie("session_id");
  
    if (!sessionId) {
      window.location.href = "/login.html";
      return;
    }
  
    try {
      const response = await fetch("https://atlasapi.t2k.group//whoami", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${sessionId}`,
          "Content-Type": "application/json"
        }
      });
  
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
  
      const result = await response.json();
  
      // Invalid token
      if (!result.status) {
        window.location.href = "/login.html";
        return;
      }
  
      const user = result.data;
      console.log("Authenticated user:", user);
  
      // Account not activated
      if (user.role === 0) {
        document.body.innerHTML = `
          <div style="
            max-width: 420px;
            margin: 10vh auto;
            padding: 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            font-family: sans-serif;
            text-align: center;
          ">
            ${user.orglogo ? `
              <img src="${user.orglogo}"
                   alt="${user.orgname}"
                   style="max-width: 200px; margin-bottom: 16px;">
            ` : ""}
            <h2>Account Not Activated</h2>
            <p><strong>${user.name}</strong></p>
            <p>${user.orgname}</p>
            <p style="margin-top: 16px;">
              Your account has not been activated.<br>
              Please contact your organisation’s admin or
              <a href="mailto:atlas@t2k.group">atlas@t2k.group</a>.
            </p>
          </div>
        `;
        return;
      }
  
      // Logged in and active → show org logo
      const orgImg = document.getElementById("org-img");
      if (orgImg && user.orglogo) {
        orgImg.src = user.orglogo;
        orgImg.removeAttribute("hidden");
      }

      // if role = 1 set anything with class user-hide to hidden
      //if role = 2 set anything with class la-hide to hidden

    if (user.role !== 1) {
      document.querySelectorAll(".user-hide").forEach(el => {
        el.hidden = false;
      });
    }

    if (user.role > 2) {
      document.querySelectorAll(".la-hide").forEach(el => {
        el.hidden = false;
      });
    }
  
      // Optional: make user globally available
      window.currentUser = user;
  
    } catch (err) {
      console.error("Auth check failed:", err);
      window.location.href = "/login.html";
    }
  })();
  