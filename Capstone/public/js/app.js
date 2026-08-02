/* =====================================================================
   STACKS — Smart Library  |  app.js  (10/10 edition)
   ===================================================================== */
const API = '/api';
let zones  = [];
let spaces = [];
let users  = [];
let charts = {};
let analyticsData = {};
let currentDays = 7;

// Active filter state
const filters = { power: false, room: false, avail: false };
let pendingReservation = null; // holds form data while modal is open
let countdownInterval  = null;

// ======================================================================
// THEME
// ======================================================================
(function initTheme() {
  const saved = localStorage.getItem('stacks-theme') || 'light';
  setTheme(saved);
})();

function setTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  const icon  = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');
  if (mode === 'dark') {
    icon.textContent  = '☀️';
    label.textContent = 'Light';
  } else {
    icon.textContent  = '🌙';
    label.textContent = 'Dark';
  }
  localStorage.setItem('stacks-theme', mode);
}

document.getElementById('themeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
});

// ======================================================================
// TABS
// ======================================================================
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`view-${tab.dataset.view}`).classList.add('active');
    if (tab.dataset.view === 'analytics') loadAnalytics();
    if (tab.dataset.view === 'reserve')   loadReservations();
    if (tab.dataset.view === 'occupied')  loadOccupied();
  });
});

// ======================================================================
// TOAST
// ======================================================================
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (type ? ` toast-${type}` : '');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

// ======================================================================
// DATA LOADING
// ======================================================================
async function loadZones() {
  zones = await fetch(`${API}/zones`).then(r => r.json());
  const zoneFilter  = document.getElementById('zoneFilter');
  const reserveZone = document.getElementById('reserveZone');
  zones.forEach(z => {
    zoneFilter.insertAdjacentHTML('beforeend', `<option value="${z.id}">${z.name}</option>`);
    reserveZone.insertAdjacentHTML('beforeend', `<option value="${z.id}">${z.name}</option>`);
  });
}

async function loadUsers() {
  users = await fetch(`${API}/users`).then(r => r.json());
  const datalist = document.getElementById('userSuggestions');
  datalist.innerHTML = users.map(u => `<option value="${u.name}">`).join('');
}

async function loadSpaces() {
  const zone_id = document.getElementById('zoneFilter').value;
  const type    = document.getElementById('typeFilter').value;
  const status  = document.getElementById('statusFilter').value;
  const params  = new URLSearchParams();
  if (zone_id) params.set('zone_id', zone_id);
  if (type)    params.set('type', type);
  if (status)  params.set('status', status);
  spaces = await fetch(`${API}/spaces?${params}`).then(r => r.json());
  renderSpaceGrid();
}

async function loadKpis() {
  const kpis = await fetch(`${API}/analytics/kpis`).then(r => r.json());
  const row = document.getElementById('kpiRow');
  row.innerHTML = `
    <div class="kpi"><div class="label">Total spaces</div><div class="value">${kpis.totalSpaces}</div></div>
    <div class="kpi"><div class="label">Occupied now</div><div class="value rust">${kpis.occupiedNow}</div></div>
    <div class="kpi"><div class="label">Reserved now</div><div class="value amber">${kpis.reservedNow}</div></div>
    <div class="kpi"><div class="label">Available now</div><div class="value sage">${kpis.availableNow}</div></div>
    <div class="kpi"><div class="label">Occupancy rate</div><div class="value">${kpis.occupancyRate}%</div></div>
  `;
}

// ======================================================================
// SPACE GRID  (with live search + chips)
// ======================================================================
function getFilteredSpaces() {
  const q = (document.getElementById('spaceSearch').value || '').toLowerCase().trim();
  return spaces.filter(s => {
    if (filters.power && !s.has_power) return false;
    if (filters.room  && s.type !== 'study_room') return false;
    if (filters.avail && s.status !== 'available') return false;
    if (!q) return true;
    return (
      s.code.toLowerCase().includes(q) ||
      s.zone_name.toLowerCase().includes(q) ||
      s.type.replace('_', ' ').includes(q) ||
      s.status.includes(q)
    );
  });
}

function renderSpaceGrid() {
  const grid = document.getElementById('spaceGrid');
  const visible = getFilteredSpaces();
  document.getElementById('spaceCount').textContent =
    `${visible.length} of ${spaces.length} spaces`;
  if (!visible.length) {
    grid.innerHTML = `<p class="empty-state">No spaces match your filters.</p>`;
    return;
  }
  grid.innerHTML = visible.map(s => `
    <div class="space-card status-${s.status}" data-id="${s.id}">
      <span class="punch ${s.status}"></span>
      <div class="space-code">${s.code}</div>
      <div class="space-meta">${s.type.replace('_', ' ')} · ${s.zone_name}${s.capacity > 1 ? ` · ${s.capacity} seats` : ''}</div>
      ${s.has_power ? '<span class="space-badge">⚡ Power</span>' : ''}
      <div class="space-status ${s.status}">${s.status}</div>
      <div class="space-actions">
        <button class="mini-btn" onclick="checkIn(${s.id}, '${s.code}')" ${s.status === 'occupied' || s.status === 'maintenance' ? 'disabled' : ''}>Check in</button>
        <button class="mini-btn" onclick="checkOut(${s.id})" ${s.status !== 'occupied' ? 'disabled' : ''}>Check out</button>
      </div>
    </div>
  `).join('');
}

// Search + chip listeners
document.getElementById('spaceSearch').addEventListener('input', renderSpaceGrid);

['chipPower', 'chipRoom', 'chipAvail'].forEach((id, i) => {
  const key = ['power', 'room', 'avail'][i];
  document.getElementById(id).addEventListener('click', () => {
    filters[key] = !filters[key];
    document.getElementById(id).classList.toggle('active', filters[key]);
    renderSpaceGrid();
  });
});

document.getElementById('zoneFilter').addEventListener('change', loadSpaces);
document.getElementById('typeFilter').addEventListener('change', loadSpaces);
document.getElementById('statusFilter').addEventListener('change', loadSpaces);

// ======================================================================
// CHECK IN / OUT
// ======================================================================
// pending check-in state
let pendingCheckinId   = null;
let pendingCheckinCode = null;

async function checkIn(id, code) {
  // Open the name modal instead of calling API immediately
  pendingCheckinId   = id;
  pendingCheckinCode = code;
  document.getElementById('checkinSpaceCode').textContent = code;
  document.getElementById('checkinName').value = '';
  document.getElementById('checkinModal').classList.add('open');
  setTimeout(() => document.getElementById('checkinName').focus(), 80);
}

// Check-in modal
document.getElementById('checkinModalCancel').addEventListener('click', () => {
  document.getElementById('checkinModal').classList.remove('open');
  pendingCheckinId = null;
});
document.getElementById('checkinModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.remove('open');
    pendingCheckinId = null;
  }
});
document.getElementById('checkinName').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('checkinModalConfirm').click();
});
document.getElementById('checkinModalConfirm').addEventListener('click', async () => {
  if (!pendingCheckinId) return;
  const name = document.getElementById('checkinName').value.trim();
  if (!name) {
    document.getElementById('checkinName').style.borderColor = 'var(--rust)';
    return;
  }
  document.getElementById('checkinModal').classList.remove('open');
  const res  = await fetch(`${API}/spaces/${pendingCheckinId}/checkin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_name: name }),
  });
  const data = await res.json();
  if (!res.ok) return showToast(data.error || 'Could not check in', 'error');
  showToast(`✅ ${name} checked in to ${data.code}`, 'success');
  pendingCheckinId = null;
});

async function checkOut(id) {
  const res  = await fetch(`${API}/spaces/${id}/checkout`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) return showToast(data.error || 'Could not check out', 'error');
  showToast(`👋 Checked out of ${data.code}`);
  if (document.getElementById('view-occupied').classList.contains('active')) loadOccupied();
}

// ======================================================================
// OCCUPIED TAB
// ======================================================================
async function loadOccupied() {
  const list      = await fetch(`${API}/occupancy/live`).then(r => r.json());
  const container = document.getElementById('occupiedTable');
  const badge     = document.getElementById('occupiedBadge');
  const subtitle  = document.getElementById('occupiedSubtitle');

  badge.textContent    = list.length || '';
  subtitle.textContent = list.length
    ? `${list.length} space${list.length > 1 ? 's' : ''} currently occupied`
    : 'No spaces are currently occupied';

  if (!list.length) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--ink-soft);">
        <div style="font-size:48px;margin-bottom:12px;">✅</div>
        <div style="font-family:var(--font-display);font-size:18px;margin-bottom:6px;">All spaces are free</div>
        <div style="font-size:13px;">No one is currently occupying any space.</div>
      </div>`;
    return;
  }

  container.innerHTML = `
    <table class="occupied-table">
      <thead><tr>
        <th>Space</th><th>Person</th><th>Type</th><th>Checked in at</th><th></th>
      </tr></thead>
      <tbody>
        ${list.map(r => {
          const initials = r.user_name && r.user_name !== 'Unknown'
            ? r.user_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
            : '?';
          const since = r.checked_in_at
            ? new Date(r.checked_in_at.replace(' ', 'T')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '—';
          return `
            <tr>
              <td><div class="occ-code">${r.code}</div><div class="occ-zone">${r.zone_name}</div></td>
              <td>
                <div class="occ-person">
                  <div class="occ-avatar">${initials}</div>
                  <div><div class="occ-name">${r.user_name}</div><div class="occ-since">Since ${since}</div></div>
                </div>
              </td>
              <td><span class="occ-type-badge">${r.type.replace('_', ' ')}${r.capacity > 1 ? ' · ' + r.capacity + ' seats' : ''}</span></td>
              <td style="font-family:var(--font-mono);font-size:12px;color:var(--ink-soft);">${since}</td>
              <td><button class="checkout-mini-btn" onclick="checkOut(${r.id})">Check out</button></td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

document.getElementById('refreshOccupiedBtn').addEventListener('click', loadOccupied);

// ======================================================================
// RESERVE VIEW
// ======================================================================
document.getElementById('reserveZone').addEventListener('change', populateReserveSpaces);

function populateReserveSpaces() {
  const zoneId = document.getElementById('reserveZone').value;
  const sel    = document.getElementById('reserveSpace');
  const filtered = spaces.filter(s => String(s.zone_id) === String(zoneId));
  sel.innerHTML  = filtered.map(s => `<option value="${s.id}">${s.code} — ${s.type.replace('_', ' ')}</option>`).join('');
}

// Form submit → open confirmation modal
document.getElementById('reserveForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('reserveMsg');
  msg.textContent = '';
  msg.className   = 'form-msg';

  const typedName = document.getElementById('userName').value.trim();
  if (!typedName) {
    msg.textContent = 'Please enter your name.';
    msg.className   = 'form-msg error';
    return;
  }

  const startDate = document.getElementById('reserveStartDate').value;
  const startTime = document.getElementById('reserveStartTime').value;
  const endDate   = document.getElementById('reserveEndDate').value;
  const endTime   = document.getElementById('reserveEndTime').value;

  if (!startDate || !startTime || !endDate || !endTime) {
    msg.textContent = 'Please fill in all date and time fields.';
    msg.className   = 'form-msg error';
    return;
  }

  const spaceId  = document.getElementById('reserveSpace').value;
  const spaceOpt = document.querySelector(`#reserveSpace option[value="${spaceId}"]`);

  // Populate modal preview
  document.getElementById('mUser').textContent  = typedName;
  document.getElementById('mSpace').textContent = spaceOpt ? spaceOpt.textContent : spaceId;
  document.getElementById('mStart').textContent = `${startDate} ${startTime}`;
  document.getElementById('mEnd').textContent   = `${endDate} ${endTime}`;

  pendingReservation = { typedName, spaceId, startDate, startTime, endDate, endTime };
  document.getElementById('confirmModal').classList.add('open');
});

// Modal cancel
document.getElementById('modalCancel').addEventListener('click', () => {
  document.getElementById('confirmModal').classList.remove('open');
  pendingReservation = null;
});
document.getElementById('confirmModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.remove('open');
    pendingReservation = null;
  }
});

// Modal confirm → execute reservation
document.getElementById('modalConfirm').addEventListener('click', async () => {
  if (!pendingReservation) return;
  document.getElementById('confirmModal').classList.remove('open');

  const { typedName, spaceId, startDate, startTime, endDate, endTime } = pendingReservation;
  const btn  = document.getElementById('reserveBtn');
  const msg  = document.getElementById('reserveMsg');
  btn.classList.add('loading');
  btn.disabled = true;

  // Resolve / auto-create user
  let user = users.find(u =>
    u.name.toLowerCase() === typedName.toLowerCase()
  );
  if (!user) {
    const guestEmail = `${typedName.toLowerCase().replace(/\s+/g, '.')}.${Date.now()}@guest.library`;
    const createRes  = await fetch(`${API}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: typedName, email: guestEmail, role: 'student' }),
    });
    if (!createRes.ok) {
      const err = await createRes.json();
      msg.textContent = err.error || 'Could not register user.';
      msg.className   = 'form-msg error';
      btn.classList.remove('loading');
      btn.disabled = false;
      return;
    }
    user = await createRes.json();
    users.push(user);
    document.getElementById('userSuggestions').insertAdjacentHTML('beforeend', `<option value="${user.name}">`);
  }

  const body = {
    user_id:    user.id,
    space_id:   spaceId,
    start_time: `${startDate} ${startTime}:00`,
    end_time:   `${endDate} ${endTime}:00`,
  };

  const res  = await fetch(`${API}/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  btn.classList.remove('loading');
  btn.disabled = false;

  if (!res.ok) {
    msg.textContent = data.error || 'Reservation failed';
    msg.className   = 'form-msg error';
    showToast('❌ ' + (data.error || 'Reservation failed'), 'error');
    return;
  }
  msg.textContent = `✓ Reserved ${data.space_code} successfully.`;
  msg.className   = 'form-msg success';
  showToast(`🎉 Reserved ${data.space_code}!`, 'success');
  pendingReservation = null;
  loadReservations();
  loadSpaces();
});

// ======================================================================
// RESERVATIONS LIST  (with live countdown)
// ======================================================================
async function loadReservations() {
  const list      = await fetch(`${API}/reservations?status=confirmed`).then(r => r.json());
  const container = document.getElementById('reservationList');
  if (!list.length) {
    container.innerHTML = `<p class="empty-state">No active reservations.</p>`;
    return;
  }
  container.innerHTML = list.map(r => `
    <div class="reservation-item" data-end="${r.end_time}">
      <div class="details">
        <strong>${r.space_code}</strong> · ${r.user_name}
        <span class="time">${fmt(r.start_time)} → ${fmt(r.end_time)}</span>
        <span class="countdown" id="cd-${r.id}">…</span>
      </div>
      <button class="cancel-btn" onclick="cancelReservation(${r.id})">Cancel</button>
    </div>
  `).join('');

  // Start countdowns
  if (countdownInterval) clearInterval(countdownInterval);
  tickCountdowns(list);
  countdownInterval = setInterval(() => tickCountdowns(list), 30000);
}

function tickCountdowns(list) {
  const now = Date.now();
  list.forEach(r => {
    const el = document.getElementById(`cd-${r.id}`);
    if (!el) return;
    const endMs = new Date(r.end_time.replace(' ', 'T')).getTime();
    const diff  = endMs - now;
    if (diff <= 0) {
      el.textContent = 'Ended';
      el.className   = 'countdown';
      return;
    }
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const label = hours >= 1 ? `Ends in ${hours}h ${mins % 60}m` : `Ends in ${mins}m`;
    el.textContent = label;
    el.className   = 'countdown' + (mins < 15 ? ' ending-soon' : '');
  });
}

function fmt(ts) {
  return new Date(ts.replace(' ', 'T')).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function cancelReservation(id) {
  const res = await fetch(`${API}/reservations/${id}`, { method: 'DELETE' });
  if (res.ok) {
    showToast('🗑 Reservation cancelled');
    loadReservations();
    loadSpaces();
  }
}

// ======================================================================
// MY BOOKINGS TAB
// ======================================================================
let activeBookingStatus = '';

document.querySelectorAll('.bstab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.bstab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeBookingStatus = btn.dataset.bstatus;
    searchBookings();
  });
});

document.getElementById('searchBookingsBtn').addEventListener('click', searchBookings);
document.getElementById('bookingName').addEventListener('keydown', e => {
  if (e.key === 'Enter') searchBookings();
});

async function searchBookings() {
  const name      = document.getElementById('bookingName').value.trim();
  const container = document.getElementById('bookingCards');
  if (!name) {
    container.innerHTML = `<p class="empty-state">Enter your name and click Search.</p>`;
    return;
  }
  container.innerHTML = `<p class="empty-state">Searching…</p>`;

  // find user by name
  const matched = users.find(u => u.name.toLowerCase() === name.toLowerCase());
  if (!matched) {
    container.innerHTML = `<p class="empty-state">No user found with the name "${name}".</p>`;
    return;
  }

  let url = `${API}/reservations?user_id=${matched.id}`;
  if (activeBookingStatus) url += `&status=${activeBookingStatus}`;

  const list = await fetch(url).then(r => r.json());
  if (!list.length) {
    container.innerHTML = `<p class="empty-state">No bookings found.</p>`;
    return;
  }
  container.innerHTML = list.map(r => `
    <div class="booking-card">
      <div class="booking-card-body">
        <div class="bcode">${r.space_code}</div>
        <div class="bzone">${r.space_type ? r.space_type.replace('_', ' ') : ''}</div>
        <div class="btime">📅 ${fmt(r.start_time)} → ${fmt(r.end_time)}</div>
        <span class="booking-status-badge ${r.status}">${r.status}</span>
      </div>
      ${r.status === 'confirmed' ? `<button class="cancel-btn" onclick="cancelAndRefreshBookings(${r.id})">Cancel</button>` : ''}
    </div>
  `).join('');
}

async function cancelAndRefreshBookings(id) {
  const res = await fetch(`${API}/reservations/${id}`, { method: 'DELETE' });
  if (res.ok) {
    showToast('🗑 Reservation cancelled');
    searchBookings();
    loadSpaces();
  }
}

// ======================================================================
// ANALYTICS
// ======================================================================
document.querySelectorAll('.days-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.days-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDays = parseInt(btn.dataset.days, 10);
    loadAnalytics();
  });
});

document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);

async function loadAnalytics() {
  const [peak, trends, zoneUsage, topSpaces, heatmap] = await Promise.all([
    fetch(`${API}/analytics/peak-hours`).then(r => r.json()),
    fetch(`${API}/analytics/trends?days=${currentDays}`).then(r => r.json()),
    fetch(`${API}/analytics/zone-usage`).then(r => r.json()),
    fetch(`${API}/analytics/space-utilization?limit=10`).then(r => r.json()),
    fetch(`${API}/analytics/heatmap`).then(r => r.json()),
  ]);

  analyticsData = { peak, trends, zoneUsage, topSpaces, heatmap };

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor  = isDark ? '#333028' : '#E9E2D0';
  const tickColor  = isDark ? '#6B6455' : '#9B9185';
  const chartDefaults = {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: tickColor, font: { family: 'IBM Plex Mono', size: 10 } } },
      y: { grid: { color: gridColor }, ticks: { color: tickColor, font: { family: 'IBM Plex Mono', size: 10 } } },
    },
  };

  renderChart('peakHoursChart', 'bar', {
    labels: peak.map(p => `${p.hour_of_day}:00`),
    datasets: [{ data: peak.map(p => p.check_in_count), backgroundColor: '#1E4D3D', borderRadius: 3 }],
  }, chartDefaults);

  renderChart('trendChart', 'line', {
    labels: trends.map(t => t.hour_bucket.slice(5, 16)),
    datasets: [{ data: trends.map(t => t.check_ins), borderColor: '#A9822F', backgroundColor: 'rgba(169,130,47,0.12)', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 }],
  }, chartDefaults);

  renderChart('zoneChart', 'bar', {
    labels: zoneUsage.map(z => z.zone_name),
    datasets: [{ data: zoneUsage.map(z => z.total_check_ins), backgroundColor: '#3C7A5C', borderRadius: 3 }],
  }, { ...chartDefaults, indexAxis: 'y' });

  renderChart('topSpacesChart', 'bar', {
    labels: topSpaces.map(s => s.code),
    datasets: [{ data: topSpaces.map(s => s.check_in_count), backgroundColor: '#A8432E', borderRadius: 3 }],
  }, { ...chartDefaults, indexAxis: 'y' });

  renderHeatmap(heatmap);
}

function renderChart(canvasId, type, data, options) {
  if (charts[canvasId]) charts[canvasId].destroy();
  const ctx = document.getElementById(canvasId).getContext('2d');
  charts[canvasId] = new Chart(ctx, { type, data, options: { responsive: true, maintainAspectRatio: false, ...options } });
}

function renderHeatmap(data) {
  const DAYS  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const maxVal = Math.max(...data.map(d => d.count), 1);
  const grid   = document.getElementById('heatmapGrid');

  // Build lookup map
  const lookup = {};
  data.forEach(d => { lookup[`${d.dow}_${d.hour}`] = d.count; });

  let html = '';
  // Header row: hour labels
  html += '<div></div>'; // corner
  for (let h = 0; h < 24; h++) html += `<div class="hm-hour-label">${h}</div>`;

  DAYS.forEach((day, di) => {
    html += `<div class="hm-day-label">${day}</div>`;
    for (let h = 0; h < 24; h++) {
      const count   = lookup[`${di + 1}_${h}`] || 0;
      const opacity = count ? (0.1 + 0.9 * (count / maxVal)).toFixed(2) : 0.06;
      const color   = `rgba(30,77,61,${opacity})`;
      html += `<div class="hm-cell" style="background:${color}" title="${day} ${h}:00 — ${count} check-ins"></div>`;
    }
  });
  grid.innerHTML = html;
}

function exportCsv() {
  const { trends } = analyticsData;
  if (!trends || !trends.length) return showToast('No data to export yet.', 'error');
  const header = 'Hour,Check-ins,Check-outs,Reservations';
  const rows   = trends.map(t => `${t.hour_bucket},${t.check_ins},${t.check_outs || 0},${t.reservations || 0}`);
  const blob   = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href = url; a.download = `stacks-analytics-${currentDays}d.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast('📥 CSV downloaded', 'success');
}

// ======================================================================
// REAL-TIME via Socket.io
// ======================================================================
const socket    = io();
const connStatus = document.getElementById('connStatus');
const connLabel  = document.getElementById('connLabel');

socket.on('connect', () => {
  connStatus.classList.add('live');
  connLabel.textContent = 'Live';
});
socket.on('disconnect', () => {
  connStatus.classList.remove('live');
  connLabel.textContent = 'Reconnecting…';
});
socket.on('occupancy:update', () => {
  loadKpis();
  loadSpaces();
  // update badge count even when not on occupied tab
  fetch(`${API}/occupancy/live`).then(r => r.json()).then(list => {
    const badge = document.getElementById('occupiedBadge');
    badge.textContent = list.length || '';
    if (document.getElementById('view-occupied').classList.contains('active')) loadOccupied();
  });
});
socket.on('reservation:created', () => {
  if (document.getElementById('view-reserve').classList.contains('active')) loadReservations();
});
socket.on('reservation:cancelled', () => {
  if (document.getElementById('view-reserve').classList.contains('active')) loadReservations();
});

// ======================================================================
// INIT
// ======================================================================
(async function init() {
  await loadZones();
  await loadUsers();
  // populate check-in name suggestions
  const checkinDl = document.getElementById('checkinSuggestions');
  if (checkinDl) checkinDl.innerHTML = users.map(u => `<option value="${u.name}">`).join('');
  await loadSpaces();
  await loadKpis();
  populateReserveSpaces();

  // Default reservation window: next hour, 1-hour duration
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);
  const end   = new Date(now.getTime() + 60 * 60000);
  const pad   = n => String(n).padStart(2, '0');
  const fmtDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fmtTime = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

  document.getElementById('reserveStartDate').value = fmtDate(now);
  document.getElementById('reserveStartTime').value = fmtTime(now);
  document.getElementById('reserveEndDate').value   = fmtDate(end);
  document.getElementById('reserveEndTime').value   = fmtTime(end);
})();
