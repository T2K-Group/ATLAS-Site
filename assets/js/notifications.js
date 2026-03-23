/**
 * Geofence Notification System
 * Stores and displays geofence enter/exit alerts in the notification bell.
 *
 * Public API: window.AtlasNotifications.add(device, site, type)
 *   device  - device name/ID string
 *   site    - geofence/site name string
 *   type    - 'enter' or 'exit'
 */
(function () {
    const STORAGE_KEY = 'atlas_geofence_notifications';

    function getNotifications() {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    }

    function saveNotifications(notifications) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    }

    function renderNotifications() {
        const notifications = getNotifications();
        const list = document.getElementById('notification-list');
        const badge = document.getElementById('notification-badge');
        const noNotif = document.getElementById('no-notifications');

        if (!list) return;

        // Remove old notification items
        list.querySelectorAll('.notification-item').forEach(function (el) { el.remove(); });

        if (notifications.length === 0) {
            noNotif.hidden = false;
            badge.hidden = true;
        } else {
            noNotif.hidden = true;
            badge.hidden = false;
            badge.textContent = notifications.length > 99 ? '99+' : notifications.length;

            // Show newest first
            notifications.slice().reverse().forEach(function (n) {
                var li = document.createElement('li');
                li.className = 'notification-item';
                var isEnter = n.type === 'enter';
                li.innerHTML =
                    '<div class="dropdown-item py-2 px-3 border-bottom">' +
                        '<div class="d-flex align-items-start gap-2">' +
                            '<i class="fa-solid ' + (isEnter ? 'fa-arrow-right-to-bracket text-success' : 'fa-arrow-right-from-bracket text-danger') + ' fa-fw mt-1"></i>' +
                            '<div class="flex-grow-1">' +
                                '<div class="fw-semibold small">' + escapeHtml(n.device) + '</div>' +
                                '<div class="small text-muted">' + (isEnter ? 'Entered' : 'Left') + ' ' + escapeHtml(n.site) + '</div>' +
                                '<div class="small text-muted">' + new Date(n.timestamp).toLocaleString() + '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>';
                list.insertBefore(li, noNotif);
            });
        }
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    document.addEventListener('DOMContentLoaded', function () {
        renderNotifications();

        var clearBtn = document.getElementById('clear-notifications');
        if (clearBtn) {
            clearBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                saveNotifications([]);
                renderNotifications();
            });
        }
    });

    window.AtlasNotifications = {
        add: function (device, site, type) {
            var notifications = getNotifications();
            notifications.push({ device: device, site: site, type: type, timestamp: Date.now() });
            saveNotifications(notifications);
            renderNotifications();
        },
        clear: function () {
            saveNotifications([]);
            renderNotifications();
        },
        getAll: function () {
            return getNotifications();
        }
    };
})();
