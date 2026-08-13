(() => {
  "use strict";

  const mobileToggle = document.querySelector("[data-mobile-nav-toggle], [data-mobile-toggle]");
  const mobileNav = document.querySelector("[data-mobile-nav], [data-mobile-panel]");

  if (mobileToggle && mobileNav) {
    const syncMobileNavigation = () => {
      if (window.matchMedia("(max-width: 980px)").matches) {
        mobileNav.hidden = mobileToggle.getAttribute("aria-expanded") !== "true";
      } else {
        mobileNav.hidden = false;
        mobileToggle.setAttribute("aria-expanded", "false");
        document.body.classList.remove("marketing-menu-open");
      }
    };
    syncMobileNavigation();
    window.addEventListener("resize", syncMobileNavigation);
    mobileToggle.addEventListener("click", () => {
      const open = mobileNav.hidden;
      mobileNav.hidden = !open;
      mobileToggle.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("marketing-menu-open", open);
    });
  }

  const dropdowns = [...document.querySelectorAll("[data-nav-dropdown]")];
  dropdowns.forEach(dropdown => {
    const trigger = dropdown.querySelector("[data-dropdown-toggle]");
    if (!trigger) return;
    trigger.addEventListener("click", event => {
      event.stopPropagation();
      const open = dropdown.classList.toggle("open");
      trigger.setAttribute("aria-expanded", String(open));
      dropdowns.forEach(other => {
        if (other === dropdown) return;
        other.classList.remove("open");
        other.querySelector("[data-dropdown-toggle]")?.setAttribute("aria-expanded", "false");
      });
    });
  });

  document.addEventListener("click", event => {
    if (!event.target.closest("[data-nav-dropdown]")) {
      dropdowns.forEach(dropdown => {
        dropdown.classList.remove("open");
        dropdown.querySelector("[data-dropdown-toggle]")?.setAttribute("aria-expanded", "false");
      });
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    dropdowns.forEach(dropdown => {
      dropdown.classList.remove("open");
      dropdown.querySelector("[data-dropdown-toggle]")?.setAttribute("aria-expanded", "false");
    });
    if (mobileNav && !mobileNav.hidden) {
      mobileNav.hidden = true;
      mobileToggle?.setAttribute("aria-expanded", "false");
      document.body.classList.remove("marketing-menu-open");
    }
  });

  document.querySelectorAll("[data-accordion-trigger]").forEach(trigger => {
    trigger.addEventListener("click", () => {
      const panel = document.getElementById(trigger.getAttribute("aria-controls"));
      if (!panel) return;
      const open = panel.hidden;
      panel.hidden = !open;
      trigger.setAttribute("aria-expanded", String(open));
      trigger.closest(".accordion-item")?.classList.toggle("open", open);
    });
  });

  const faqSearch = document.querySelector("[data-faq-search]");
  const faqItems = [...document.querySelectorAll(".accordion-item")];
  const faqButtons = [...document.querySelectorAll("[data-faq-filter]")];
  const faqNoResults = document.querySelector(".faq-no-results");
  const faqSummary = document.querySelector("[data-faq-result-count]");
  let faqCategory = "all";

  function filterFaqs() {
    if (!faqItems.length) return;
    const query = faqSearch?.value.trim().toLowerCase() || "";
    let count = 0;
    faqItems.forEach(item => {
      const category = item.dataset.faqCategory || item.closest("[data-faq-category]")?.dataset.faqCategory || "all";
      const matchesCategory = faqCategory === "all" || category === faqCategory;
      const matchesQuery = !query || item.textContent.toLowerCase().includes(query);
      const visible = matchesCategory && matchesQuery;
      item.hidden = !visible;
      if (visible) count++;
    });
    document.querySelectorAll("[data-faq-heading]").forEach(heading => {
      const category = heading.dataset.faqHeading;
      const sectionItems = faqItems.filter(item => (item.dataset.faqCategory || item.closest("[data-faq-category]")?.dataset.faqCategory) === category);
      heading.hidden = sectionItems.length > 0 && sectionItems.every(item => item.hidden);
    });
    if (faqNoResults) faqNoResults.hidden = count !== 0;
    if (faqSummary) faqSummary.textContent = `${count} question${count === 1 ? "" : "s"}`;
  }

  faqSearch?.addEventListener("input", filterFaqs);
  faqButtons.forEach(button => button.addEventListener("click", () => {
    faqCategory = button.dataset.faqFilter || "all";
    faqButtons.forEach(item => item.classList.toggle("active", item === button));
    filterFaqs();
  }));

  document.querySelectorAll("[data-content-filter]").forEach(button => {
    button.addEventListener("click", () => {
      const filter = button.dataset.contentFilter;
      const group = button.closest(".section, main") || document;
      group.querySelectorAll("[data-content-filter]").forEach(item => item.classList.toggle("active", item === button));
      document.querySelectorAll("[data-content-category]").forEach(card => {
        card.hidden = filter !== "all" && card.dataset.contentCategory !== filter;
      });
    });
  });

  document.querySelectorAll("[data-contact-form]").forEach(form => {
    const showSubmitError = messageText => {
      form.querySelector("[data-form-submit-error]")?.remove();
      const message = document.createElement("p");
      message.dataset.formSubmitError = "";
      message.className = "form-submit-error";
      message.setAttribute("role", "alert");
      message.textContent = messageText;
      form.append(message);
      message.focus?.();
    };

    form.addEventListener("submit", async event => {
      event.preventDefault();
      let valid = true;
      form.querySelectorAll("[required]").forEach(field => {
        const wrapper = field.closest(".form-field");
        const fieldValid = field.type === "checkbox" ? field.checked : field.checkValidity();
        wrapper?.classList.toggle("invalid", !fieldValid);
        valid = valid && fieldValid;
      });
      if (!valid) {
        form.querySelector(":invalid")?.focus();
        return;
      }

      const turnstileToken = form.querySelector('[name="cf-turnstile-response"]')?.value;
      if (!turnstileToken) {
        showSubmitError("Please complete the security check before submitting.");
        return;
      }

      const submit = form.querySelector('[type="submit"]');
      const originalLabel = submit?.innerHTML;
      const existingError = form.querySelector("[data-form-submit-error]");
      existingError?.remove();
      if (submit) {
        submit.disabled = true;
        submit.textContent = "Sending…";
      }
      try {
        const formData = new FormData(form);
        const formDetails = Object.fromEntries(formData.entries());
        delete formDetails["cf-turnstile-response"];
        formDetails.consent = formData.has("consent");
        const response = await fetch("https://api.t2k.group/v1/content/forms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-Turnstile-Token": turnstileToken
          },
          body: JSON.stringify({
            source: "https://atlas-tracking.co.uk/contact/",
            form_details: formDetails
          })
        });
        if (!response.ok) throw new Error(`Contact form returned ${response.status}`);
        form.hidden = true;
        const success = form.parentElement?.querySelector("[data-form-success]") || document.querySelector("[data-form-success]");
        if (success) {
          success.hidden = false;
          success.focus();
        }
      } catch (error) {
        console.error("Unable to submit contact form", error);
        showSubmitError("We could not send your enquiry. Please try again or email atlas@t2k.group.");
      } finally {
        window.turnstile?.reset("#contact-turnstile");
        if (submit) {
          submit.disabled = false;
          submit.innerHTML = originalLabel;
        }
      }
    });
  });

  const homepageMapElement = document.querySelector("[data-homepage-map]");
  if (homepageMapElement) {
    const status = document.querySelector("[data-homepage-map-status]");
    if (!window.L) {
      if (status) status.textContent = "Interactive map unavailable";
    } else {
      const map = L.map(homepageMapElement, {
        zoomControl: true,
        preferCanvas: true,
        scrollWheelZoom: true
      }).setView([51.5074, -0.1278], 11);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
      }).addTo(map);

      const trackerIcon = number => L.divIcon({
        className: "homepage-tracker-icon",
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="39" viewBox="0 0 32 42" aria-hidden="true"><path d="M16 1.5C8.1 1.5 1.8 7.8 1.8 15.6c0 10.3 14.2 24.7 14.2 24.7s14.2-14.4 14.2-24.7C30.2 7.8 23.9 1.5 16 1.5Z" fill="#2563eb" stroke="#fff" stroke-width="2"/><circle cx="16" cy="15.5" r="8.7" fill="#fff"/><text x="16" y="18.2" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" font-weight="700" fill="#17202a">${number}</text></svg>`,
        iconSize: [30, 39],
        iconAnchor: [15, 38],
        popupAnchor: [0, -34]
      });

      const randomOffset = spread => (Math.random() - .5) * spread;
      const signalLabel = dbm => dbm >= -85 ? "Excellent" : dbm >= -100 ? "Good" : "Fair";
      const popupContent = tracker => {
        const point = tracker.marker.getLatLng();
        const batteryTone = tracker.battery >= 60 ? "good" : tracker.battery >= 30 ? "fair" : "low";
        const signalTone = tracker.signal >= -85 ? "good" : tracker.signal >= -100 ? "fair" : "low";
        return `<div class="homepage-map-popup">
          <div class="map-popup-head"><span class="map-popup-icon">${tracker.number}</span><span><strong>Demo tracker #${tracker.number}</strong><small><i></i> Online · updated just now</small></span></div>
          <div class="map-popup-coordinates"><span>Current position</span><code>${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}</code></div>
          <div class="map-popup-metrics">
            <span><small>Battery</small><strong class="${batteryTone}">${tracker.battery}%</strong></span>
            <span><small>Cell signal</small><strong class="${signalTone}">${signalLabel(tracker.signal)}</strong><em>${tracker.signal} dBm</em></span>
          </div>
          <div class="map-popup-foot">Simulated demonstration data</div>
        </div>`;
      };
      const trackers = Array.from({ length: 28 }, (_, index) => {
        const number = index + 1;
        const marker = L.marker([
          51.5074 + randomOffset(.16),
          -0.1278 + randomOffset(.28)
        ], { icon: trackerIcon(number), title: `Demo tracker ${number}` }).addTo(map);
        const tracker = {
          number,
          marker,
          battery: 38 + Math.floor(Math.random() * 61),
          signal: -72 - Math.floor(Math.random() * 35)
        };
        marker.bindPopup(() => popupContent(tracker), { minWidth: 245, maxWidth: 270 });
        return tracker;
      });

      let updateCount = 0;
      const updateTrackers = () => {
        trackers.forEach(tracker => {
          const point = tracker.marker.getLatLng();
          tracker.marker.setLatLng([point.lat + randomOffset(.0012), point.lng + randomOffset(.0018)]);
          tracker.signal = Math.max(-110, Math.min(-68, tracker.signal + Math.round(randomOffset(5))));
          if (Math.random() > .96) tracker.battery = Math.max(20, tracker.battery - 1);
          if (tracker.marker.isPopupOpen()) tracker.marker.setPopupContent(popupContent(tracker));
        });
        updateCount += 1;
        if (status) status.textContent = `${trackers.length} demo trackers online · updated ${updateCount === 1 ? "now" : "again"}`;
      };

      if (status) status.textContent = `${trackers.length} demo trackers online`;
      const updateTimer = window.setInterval(updateTrackers, 5000);
      window.addEventListener("pagehide", () => window.clearInterval(updateTimer), { once: true });
      requestAnimationFrame(() => map.invalidateSize());
    }
  }
})();
