// ===== ARDPS Frontend Application =====
const API = '';

// Initialize Date Pickers
document.addEventListener('DOMContentLoaded', () => {
  flatpickr('#search-date', {
    minDate: 'today',
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'F j, Y',
    theme: 'dark'
  });
  
  flatpickr('#pax-dob', {
    maxDate: 'today',
    dateFormat: 'Y-m-d',
    altInput: true,
    altFormat: 'F j, Y',
    theme: 'dark'
  });
});


// ===== UTILITY =====
function toast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function showLoading(el) {
  el.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
}

function emptyState(el, icon, msg) {
  el.innerHTML = `<div class="empty-state"><div class="icon">${icon}</div><p>${msg}</p></div>`;
}

function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateTime(d) {
  return `${formatDate(d)} ${formatTime(d)}`;
}

function getDuration(dep, arr) {
  const ms = new Date(arr) - new Date(dep);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

// ===== NAVIGATION =====
const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('.page');

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const page = link.dataset.page;
    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    pages.forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    // Load data per page
    if (page === 'passengers') loadPassengers();
    if (page === 'bookings') loadBookings();
    if (page === 'tickets') { document.getElementById('tickets-list').innerHTML = ''; document.getElementById('ticket-result').innerHTML = ''; }
    if (page === 'admin') loadAdminStats();
  });
});

// ===== AIRPORTS DROPDOWN =====
async function loadAirports() {
  try {
    const res = await fetch(`${API}/api/admin/airports`);
    const data = await res.json();
    if (data.success) {
      const selO = document.getElementById('search-origin');
      const selD = document.getElementById('search-destination');
      data.data.forEach(a => {
        const optO = new Option(`${a._id} — ${a.city}`, a._id);
        const optD = new Option(`${a._id} — ${a.city}`, a._id);
        selO.add(optO);
        selD.add(optD);
      });
    }
  } catch (e) { console.error('Failed to load airports:', e); }
}

// ===== FLIGHT SEARCH =====
document.getElementById('btn-search-flights').addEventListener('click', searchFlights);

async function searchFlights() {
  const origin = document.getElementById('search-origin').value;
  const destination = document.getElementById('search-destination').value;
  const date = document.getElementById('search-date').value;
  const container = document.getElementById('flight-results');
  showLoading(container);

  try {
    let url = `${API}/api/flights`;
    const params = new URLSearchParams();
    if (origin || destination || date) {
      url = `${API}/api/flights/search`;
      if (origin) params.append('origin', origin);
      if (destination) params.append('destination', destination);
      if (date) params.append('date', date);
    }
    const fullUrl = params.toString() ? `${url}?${params}` : url;
    const res = await fetch(fullUrl);
    const data = await res.json();

    if (!data.success || !data.data.length) {
      emptyState(container, '🔍', 'No flights found. Try changing your search criteria.');
      return;
    }
    renderFlights(data.data, container);
  } catch (e) {
    toast('Failed to search flights', 'error');
    emptyState(container, '❌', 'Error loading flights');
  }
}

function renderFlights(flights, container) {
  container.innerHTML = flights.map(f => {
    const originCode = f.origin ? f.origin._id : f.origin_ref;
    const destCode = f.destination ? f.destination._id : f.destination_ref;
    const originCity = f.origin ? f.origin.city : '';
    const destCity = f.destination ? f.destination.city : '';
    const ecoAvail = f.seat_inventory.economy.available;
    const busAvail = f.seat_inventory.business.available;
    const ecoPrice = f.base_fare.economy || 0;
    const seatClass = ecoAvail < 10 ? (ecoAvail === 0 ? 'full' : 'low') : 'available';

    return `
      <div class="flight-card">
        <div class="flight-endpoint">
          <div class="code">${originCode}</div>
          <div class="city">${originCity}</div>
          <div class="time">${formatTime(f.departure_time)}</div>
        </div>
        <div class="flight-route">
          <div class="flight-num">${f.flight_number}</div>
          <div class="duration">${getDuration(f.departure_time, f.arrival_time)}</div>
          <div class="line"></div>
          <div class="duration">${formatDate(f.departure_time)}</div>
        </div>
        <div class="flight-endpoint">
          <div class="code">${destCode}</div>
          <div class="city">${destCity}</div>
          <div class="time">${formatTime(f.arrival_time)}</div>
        </div>
        <div class="flight-actions">
          <div class="flight-price"><span class="currency">₹</span>${ecoPrice.toLocaleString('en-IN')}</div>
          <div class="flight-seats">
            <span class="seat-badge ${seatClass}">${ecoAvail} eco</span>
            <span class="seat-badge ${busAvail > 0 ? 'available' : 'full'}">${busAvail} biz</span>
          </div>
          <button class="btn btn-primary btn-sm" onclick="openBookingModal('${f._id}', '${originCode}', '${destCode}', '${f.flight_number}', '${f.departure_time}')">Book Now</button>
        </div>
      </div>
    `;
  }).join('');
}

// ===== BOOKING MODAL =====
let currentFlightId = '';
let selectedSeatId = '';
let currentHoldToken = null;
let seatMapInterval = null;

async function openBookingModal(flightId, origin, dest, flightNum, dep) {
  currentFlightId = flightId;
  selectedSeatId = '';
  currentHoldToken = null;
  document.getElementById('booking-seat').value = '';
  document.getElementById('selected-seat-label').textContent = '';

  const modal = document.getElementById('booking-modal');
  const info = document.getElementById('booking-flight-info');
  info.innerHTML = `<strong>${flightNum}</strong> · ${origin} → ${dest} · ${formatDateTime(dep)}`;

  // Load passengers into dropdown
  const sel = document.getElementById('booking-passenger');
  sel.innerHTML = '<option value="">Select Passenger</option>';
  try {
    const res = await fetch(`${API}/api/passengers`);
    const data = await res.json();
    if (data.success) {
      data.data.forEach(p => {
        sel.add(new Option(`${p.full_name} (${p.email})`, p._id));
      });
    }
  } catch (e) { toast('Failed to load passengers', 'error'); }

  // Reset pricing
  document.getElementById('booking-pricing').innerHTML = '';
  modal.classList.add('active');

  // Load seat map + pricing
  loadSeatMap();
  fetchBookingPrice();

  if (seatMapInterval) clearInterval(seatMapInterval);
  seatMapInterval = setInterval(silentRefreshSeatMap, 3000);
}

document.getElementById('booking-modal-close').addEventListener('click', () => {
  document.getElementById('booking-modal').classList.remove('active');
  if (seatMapInterval) clearInterval(seatMapInterval);
});

// When cabin class changes, reload seat map and pricing
document.getElementById('booking-cabin').addEventListener('change', () => {
  selectedSeatId = '';
  document.getElementById('booking-seat').value = '';
  document.getElementById('selected-seat-label').textContent = '';
  loadSeatMap();
  fetchBookingPrice();
});

// ===== SEAT MAP =====
async function loadSeatMap() {
  const cabin = document.getElementById('booking-cabin').value;
  const container = document.getElementById('seat-map');
  container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

  try {
    const res = await fetch(`${API}/api/flights/${currentFlightId}/seats?cabin_class=${cabin}`);
    const data = await res.json();

    if (!data.success) {
      container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:1rem">Seat map unavailable</p>';
      return;
    }

    renderSeatMap(data.data, container);
  } catch (e) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:1rem">Failed to load seats</p>';
  }
}

function renderSeatMap(seatData, container) {
  const { seats, columns, aisle_after } = seatData;

  // Group seats by row
  const rowMap = {};
  seats.forEach(s => {
    if (!rowMap[s.row]) rowMap[s.row] = [];
    rowMap[s.row].push(s);
  });

  // Build column headers
  let colHeaderHTML = '<div class="row-num"></div>';
  columns.forEach((c, i) => {
    colHeaderHTML += `<div class="col-header">${c}</div>`;
    if (aisle_after.includes(i)) colHeaderHTML += '<div class="col-header aisle-gap"></div>';
  });

  // Build rows
  let rowsHTML = '';
  const rowNums = Object.keys(rowMap).sort((a, b) => a - b);
  for (const rn of rowNums) {
    let rowHTML = `<div class="row-num">${rn}</div>`;
    const rowSeats = rowMap[rn];
    rowSeats.forEach((s, i) => {
      const colIdx = columns.indexOf(s.col);
      const cls = s.id === selectedSeatId ? 'selected' : (s.status === 'booked' ? 'booked' : (s.status === 'held' ? 'held' : 'available'));
      const clickable = s.status === 'available';
      rowHTML += `<div class="seat ${cls}" ${clickable ? `onclick="selectSeat('${s.id}')"` : ''} title="${s.id} – ${s.status}">${s.id}</div>`;
      if (aisle_after.includes(colIdx)) rowHTML += '<div class="seat-aisle"></div>';
    });
    rowsHTML += `<div class="seat-row">${rowHTML}</div>`;
  }

  container.innerHTML = `
    <div class="airplane-nose"></div>
    <div class="col-headers">${colHeaderHTML}</div>
    ${rowsHTML}
  `;
}

async function silentRefreshSeatMap() {
  const cabin = document.getElementById('booking-cabin').value;
  try {
    const res = await fetch(`${API}/api/flights/${currentFlightId}/seats?cabin_class=${cabin}&_t=${Date.now()}`);
    const data = await res.json();
    if (!data.success) return;
    
    const newSeats = data.data.seats;
    const allSeatElements = document.querySelectorAll('#seat-map .seat');
    
    allSeatElements.forEach(el => {
      const seatId = el.textContent.trim();
      const serverSeat = newSeats.find(s => s.id === seatId);
      if (serverSeat) {
        let expectedClass = serverSeat.status === 'booked' ? 'booked' : (serverSeat.status === 'held' ? 'held' : 'available');
        if (seatId === selectedSeatId) expectedClass = 'selected';
        
        if (!el.classList.contains(expectedClass)) {
          el.className = `seat ${expectedClass}`;
          const isClickable = expectedClass === 'available';
          el.onclick = isClickable ? () => selectSeat(seatId) : null;
          el.title = `${seatId} – ${serverSeat.status}`;
        }
      }
    });
  } catch (e) {
    // silent failure during polling
  }
}

async function selectSeat(seatId) {
  if (seatId === selectedSeatId) return; // Prevent re-clicking the same seat

  const passengerId = document.getElementById('booking-passenger').value;
  if (!passengerId) {
    toast('Please select a passenger first before choosing a seat.', 'warning');
    return;
  }

  const cabin = document.getElementById('booking-cabin').value;
  document.getElementById('selected-seat-label').textContent = `— Holding ${seatId}...`;

  try {
    const res = await fetch(`${API}/api/flights/${currentFlightId}/seats/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seat_number: seatId, cabin_class: cabin, passenger_id: passengerId })
    });
    const data = await res.json();

    if (!data.success) {
      toast(data.error || 'Seat is no longer available.', 'error');
      loadSeatMap();
      return;
    }

    currentHoldToken = data.data.hold_token;
    selectedSeatId = seatId;
    document.getElementById('booking-seat').value = seatId;
    document.getElementById('selected-seat-label').textContent = `— Seat ${seatId} (Held)`;

    // Re-render to update the visual selection
    const allSeats = document.querySelectorAll('#seat-map .seat');
    allSeats.forEach(el => {
      if (el.classList.contains('booked') || el.classList.contains('held')) return;
      if (el.textContent.trim() === seatId) {
        el.classList.remove('available');
        el.classList.add('selected');
      } else {
        el.classList.remove('selected');
        el.classList.add('available');
      }
    });
  } catch (e) {
    toast('Failed to hold seat: ' + e.message, 'error');
  }
}

async function fetchBookingPrice() {
  const cabin = document.getElementById('booking-cabin').value;
  const meal = document.getElementById('booking-meal').value;
  const container = document.getElementById('booking-pricing');

  try {
    const fRes = await fetch(`${API}/api/flights/${currentFlightId}`);
    const fData = await fRes.json();
    if (!fData.success) return;

    const f = fData.data;
    const res = await fetch(`${API}/api/pricing?origin=${f.origin_ref}&destination=${f.destination_ref}&cabin_class=${cabin}&flight_id=${currentFlightId}&meal=${encodeURIComponent(meal)}`);
    const data = await res.json();

    if (data.success) {
      const p = data.data;
      const adv = p.advance_booking;

      // Advance booking label & color
      let advLabel, advColor, advDisplay;
      if (adv.discount_pct > 0) {
        advLabel = `${adv.label} (${adv.days_before}d)`;
        advColor = 'var(--success)';
        advDisplay = `-${adv.discount_pct}% (−₹${Math.abs(adv.adjustment).toLocaleString('en-IN')})`;
      } else if (adv.discount_pct < 0) {
        advLabel = `${adv.label} (${adv.days_before}d)`;
        advColor = 'var(--danger)';
        advDisplay = `+${Math.abs(adv.discount_pct)}% (+₹${Math.abs(adv.adjustment).toLocaleString('en-IN')})`;
      } else {
        advLabel = `Booking ${adv.days_before}d before`;
        advColor = 'var(--text-muted)';
        advDisplay = '0%';
      }

      // Meal label
      let mealDisplay = 'None (₹0)';
      if (p.meal_surcharge > 0) {
        mealDisplay = `${p.meal_type} (+₹${p.meal_surcharge.toLocaleString('en-IN')})`;
      }

      container.innerHTML = `
        <h4 style="margin-bottom:8px;font-size:0.9rem;color:var(--accent-light)">Dynamic Pricing</h4>
        <div class="pricing-row"><span>Base Price</span><span>₹${p.base_price.toLocaleString('en-IN')}</span></div>
        <div class="pricing-row"><span>Occupancy</span><span>${p.occupancy_pct}%</span></div>
        <div class="pricing-row"><span>Demand Multiplier</span><span>×${p.demand_multiplier}</span></div>
        <div class="pricing-row"><span>After Demand</span><span>₹${p.fare_after_demand.toLocaleString('en-IN')}</span></div>
        <div class="pricing-row" style="color:${advColor}"><span>Advance Booking — ${advLabel}</span><span>${advDisplay}</span></div>
        <div class="pricing-row" style="color:${p.meal_surcharge > 0 ? 'var(--warning)' : 'var(--text-muted)'}"><span>Meal Surcharge</span><span>${mealDisplay}</span></div>
        <div class="pricing-row"><span>Taxes (12%)</span><span>₹${p.taxes.toLocaleString('en-IN')}</span></div>
        <div class="pricing-row total"><span>Total Fare</span><span>₹${p.total_fare.toLocaleString('en-IN')}</span></div>
        <div class="pricing-row"><span>Seats Available</span><span>${p.seats_available}/${p.seats_total}</span></div>
      `;
    }
  } catch (e) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">Price calculation unavailable</p>';
  }
}

// Re-fetch price when meal preference changes
document.getElementById('booking-meal').addEventListener('change', fetchBookingPrice);

// Submit booking
document.getElementById('booking-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btn-confirm-booking');
  btn.disabled = true;
  btn.textContent = 'Processing...';

  const seatNumber = document.getElementById('booking-seat').value;
  if (!seatNumber) {
    toast('Please select a seat from the seat map', 'error');
    btn.disabled = false;
    btn.textContent = 'Confirm Booking';
    return;
  }

  const body = {
    passenger_id: document.getElementById('booking-passenger').value,
    flight_id: currentFlightId,
    cabin_class: document.getElementById('booking-cabin').value,
    payment_method: document.getElementById('booking-payment').value,
    meal_preference: document.getElementById('booking-meal').value || undefined,
    seat_number: seatNumber,
    hold_token: currentHoldToken
  };

  if (!body.passenger_id) {
    toast('Please select a passenger', 'error');
    btn.disabled = false;
    btn.textContent = 'Confirm Booking';
    return;
  }

  try {
    const res = await fetch(`${API}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (data.success) {
      toast(`Booking ${data.data.booking.booking_ref} confirmed! Seat ${seatNumber} · PNR: ${data.data.ticket.pnr}`, 'success');
      document.getElementById('booking-modal').classList.remove('active');
      if (seatMapInterval) clearInterval(seatMapInterval);
      searchFlights(); // Refresh to show updated availability
    } else {
      toast(data.error || 'Booking failed', 'error');
      // Reload seat map in case someone else booked the seat
      loadSeatMap();
    }
  } catch (e) {
    toast('Booking failed: ' + e.message, 'error');
  }

  btn.disabled = false;
  btn.textContent = 'Confirm Booking';
});

// ===== PASSENGERS =====
document.getElementById('passenger-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const body = {
    full_name: document.getElementById('pax-name').value,
    email: document.getElementById('pax-email').value,
    phone: document.getElementById('pax-phone').value,
    passport_number: document.getElementById('pax-passport').value || undefined,
    nationality: document.getElementById('pax-nationality').value,
    date_of_birth: document.getElementById('pax-dob').value,
    preferences: {}
  };

  const meal = document.getElementById('pax-meal').value;
  const seat = document.getElementById('pax-seat').value;
  if (meal) body.preferences.meal = meal;
  if (seat) body.preferences.seat_type = seat;
  if (!meal && !seat) delete body.preferences;

  try {
    const res = await fetch(`${API}/api/passengers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();

    if (data.success) {
      toast(`Passenger ${data.data.full_name} registered!`, 'success');
      document.getElementById('passenger-form').reset();
      loadPassengers();
    } else {
      toast(data.error || 'Registration failed', 'error');
    }
  } catch (e) {
    toast('Failed: ' + e.message, 'error');
  }
});

async function loadPassengers() {
  const container = document.getElementById('passengers-list');
  showLoading(container);

  try {
    const res = await fetch(`${API}/api/passengers`);
    const data = await res.json();

    if (!data.success || !data.data.length) {
      emptyState(container, '👤', 'No passengers found');
      return;
    }

    container.innerHTML = data.data.map(p => {
      let badge = '';
      if (p.frequent_flyer) {
        const cls = `badge-${p.frequent_flyer.tier.toLowerCase()}`;
        badge = `<span class="badge ${cls}">${p.frequent_flyer.tier} · ${p.frequent_flyer.miles} mi</span>`;
      }
      return `
        <div class="passenger-card">
          <div class="name">${p.full_name}</div>
          <div class="details">
            <span>📧 ${p.email}</span>
            <span>📱 ${p.phone}</span>
          </div>
          <div class="details">
            <span>🌍 ${p.nationality}</span>
            ${p.passport_number ? `<span>🛂 ${p.passport_number}</span>` : ''}
            <span>🎂 ${formatDate(p.date_of_birth)}</span>
          </div>
          ${badge}
        </div>
      `;
    }).join('');
  } catch (e) {
    emptyState(container, '❌', 'Error loading passengers');
  }
}

// ===== BOOKINGS =====
async function loadBookings() {
  const container = document.getElementById('bookings-list');
  showLoading(container);

  try {
    const res = await fetch(`${API}/api/bookings`);
    const data = await res.json();

    if (!data.success || !data.data.length) {
      emptyState(container, '📋', 'No bookings yet');
      return;
    }

    container.innerHTML = data.data.map(b => {
      const passengerName = b.passenger ? b.passenger.full_name : 'Unknown';
      const flightNum = b.flight ? b.flight.flight_number : b.flight_ref;
      const origin = b.flight ? b.flight.origin_ref : '';
      const dest = b.flight ? b.flight.destination_ref : '';
      const statusClass = `status-${b.booking_status}`;

      let cancelBtn = '';
      if (b.booking_status === 'confirmed') {
        cancelBtn = `<button class="btn btn-danger btn-sm" onclick="openCancelModal('${b.booking_ref}', '${passengerName}', ${b.fare_paid})">Cancel</button>`;
      }

      let refundInfo = '';
      if (b.booking_status === 'cancelled' && b.cancellation) {
        refundInfo = `<div style="font-size:0.75rem;color:var(--warning)">Refund: ₹${b.cancellation.refund_amount}</div>`;
      }

      return `
        <div class="booking-card">
          <div class="booking-ref">${b.booking_ref}</div>
          <div class="booking-details">
            <div class="passenger-name">${passengerName}</div>
            <div class="flight-info">${flightNum} · ${origin} → ${dest} · Seat ${b.seat_number}</div>
            <div class="meta">
              <span>🎫 ${b.cabin_class}</span>
              <span>💳 ${b.payment ? b.payment.method : '—'}</span>
              <span>📅 ${formatDate(b.booked_at)}</span>
            </div>
          </div>
          <div class="booking-status">
            <span class="status-badge ${statusClass}">${b.booking_status}</span>
            <div class="booking-fare">₹${Number(b.fare_paid).toLocaleString('en-IN')}</div>
            ${refundInfo}
            ${cancelBtn}
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    emptyState(container, '❌', 'Error loading bookings');
  }
}

// ===== CANCEL MODAL =====
let currentCancelRef = '';

function openCancelModal(bookingRef, passengerName, fare) {
  currentCancelRef = bookingRef;
  document.getElementById('cancel-info').innerHTML =
    `Cancel booking <strong>${bookingRef}</strong> for ${passengerName}?<br>Estimated refund: <strong>₹${Math.round(fare * 0.8).toLocaleString('en-IN')}</strong> (80% refund policy)`;
  document.getElementById('cancel-reason').value = '';
  document.getElementById('cancel-modal').classList.add('active');
}

document.getElementById('cancel-modal-close').addEventListener('click', () => {
  document.getElementById('cancel-modal').classList.remove('active');
});

document.getElementById('btn-cancel-dismiss').addEventListener('click', () => {
  document.getElementById('cancel-modal').classList.remove('active');
});

document.getElementById('btn-confirm-cancel').addEventListener('click', async () => {
  const btn = document.getElementById('btn-confirm-cancel');
  btn.disabled = true;

  try {
    const res = await fetch(`${API}/api/bookings/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booking_ref: currentCancelRef,
        reason: document.getElementById('cancel-reason').value || 'Customer requested'
      })
    });
    const data = await res.json();

    if (data.success) {
      toast(`Booking ${currentCancelRef} cancelled. ${data.data.message}`, 'success');
      document.getElementById('cancel-modal').classList.remove('active');
      loadBookings();
    } else {
      toast(data.error || 'Cancellation failed', 'error');
    }
  } catch (e) {
    toast('Cancellation failed: ' + e.message, 'error');
  }
  btn.disabled = false;
});

// ===== TICKETS =====
document.getElementById('btn-search-ticket').addEventListener('click', searchTicket);

async function searchTicket() {
  const pnr = document.getElementById('ticket-pnr').value.trim();
  if (!pnr) { toast('Enter a PNR number', 'error'); return; }

  const container = document.getElementById('ticket-result');
  document.getElementById('tickets-list').innerHTML = '';
  showLoading(container);

  try {
    const res = await fetch(`${API}/api/tickets/${pnr}`);
    const data = await res.json();

    if (!data.success) {
      emptyState(container, '🔍', `No ticket found for PNR: ${pnr}`);
      return;
    }
    renderTicket(data.data, container);
  } catch (e) {
    emptyState(container, '❌', 'Error searching ticket');
  }
}

function renderTicket(t, container) {
  const originCode = t.flight ? t.flight.origin_ref : '—';
  const destCode = t.flight ? t.flight.destination_ref : '—';
  const dep = t.flight ? t.flight.departure_time : null;
  const arr = t.flight ? t.flight.arrival_time : null;
  const flightNum = t.flight ? t.flight.flight_number : '—';
  const passengerName = t.passenger ? t.passenger.full_name : '—';
  const fare = t.booking ? t.booking.fare_paid : '—';
  const statusColor = t.status === 'valid' ? 'var(--success)' : (t.status === 'cancelled' ? 'var(--danger)' : 'var(--warning)');

  container.innerHTML = `
    <div class="ticket-card-full">
      <div class="ticket-header">
        <div class="airline">✈ ARDPS Airlines</div>
        <div class="pnr">${t.pnr}</div>
      </div>
      <div class="ticket-body">
        <div class="endpoint">
          <div class="label">From</div>
          <div class="code">${originCode}</div>
          <div class="datetime">${formatDateTime(dep)}</div>
        </div>
        <div class="ticket-divider">
          <div class="dashes"></div>
          <div class="plane-icon">✈</div>
          <div class="dashes"></div>
        </div>
        <div class="endpoint">
          <div class="label">To</div>
          <div class="code">${destCode}</div>
          <div class="datetime">${formatDateTime(arr)}</div>
        </div>
      </div>
      <div class="ticket-footer">
        <div class="ticket-field"><div class="label">Passenger</div><div class="value">${passengerName}</div></div>
        <div class="ticket-field"><div class="label">Flight</div><div class="value">${flightNum}</div></div>
        <div class="ticket-field"><div class="label">Seat</div><div class="value">${t.seat_number}</div></div>
        <div class="ticket-field"><div class="label">Class</div><div class="value" style="text-transform:capitalize">${t.cabin_class}</div></div>
        <div class="ticket-field"><div class="label">Baggage</div><div class="value">${t.baggage.check_in_kg}kg + ${t.baggage.cabin_kg}kg</div></div>
        <div class="ticket-field"><div class="label">Fare</div><div class="value">₹${Number(fare).toLocaleString('en-IN')}</div></div>
        <div class="ticket-field"><div class="label">Status</div><div class="value" style="color:${statusColor};text-transform:uppercase">${t.status}</div></div>
        ${t.meal_preference ? `<div class="ticket-field"><div class="label">Meal</div><div class="value" style="text-transform:capitalize">${t.meal_preference}</div></div>` : ''}
      </div>
    </div>
  `;
}

document.getElementById('btn-all-tickets').addEventListener('click', async () => {
  const container = document.getElementById('tickets-list');
  document.getElementById('ticket-result').innerHTML = '';
  showLoading(container);

  try {
    const res = await fetch(`${API}/api/tickets`);
    const data = await res.json();

    if (!data.success || !data.data.length) {
      emptyState(container, '🎫', 'No tickets found');
      return;
    }

    container.innerHTML = data.data.map(t => {
      const passengerName = t.passenger ? t.passenger.full_name : 'Unknown';
      const flightNum = t.flight ? t.flight.flight_number : t.flight_ref;
      const origin = t.flight ? t.flight.origin_ref : '';
      const dest = t.flight ? t.flight.destination_ref : '';
      const statusColor = t.status === 'valid' ? 'var(--success)' : 'var(--danger)';

      return `
        <div class="booking-card" style="cursor:pointer" onclick="document.getElementById('ticket-pnr').value='${t.pnr}';searchTicket()">
          <div class="booking-ref">${t.pnr}</div>
          <div class="booking-details">
            <div class="passenger-name">${passengerName}</div>
            <div class="flight-info">${flightNum} · ${origin} → ${dest} · Seat ${t.seat_number}</div>
            <div class="meta">
              <span>🎫 ${t.cabin_class}</span>
              <span>🧳 ${t.baggage.check_in_kg}kg + ${t.baggage.cabin_kg}kg</span>
            </div>
          </div>
          <div class="booking-status">
            <span class="status-badge" style="background:${t.status === 'valid' ? 'var(--success-bg)' : 'var(--danger-bg)'};color:${statusColor}">${t.status}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    emptyState(container, '❌', 'Error loading tickets');
  }
});

// ===== ADMIN DASHBOARD =====
async function loadAdminStats() {
  const statsContainer = document.getElementById('admin-stats');
  showLoading(statsContainer);

  try {
    const res = await fetch(`${API}/api/admin/stats`);
    const data = await res.json();

    if (!data.success) { toast('Failed to load stats', 'error'); return; }

    const s = data.data;
    const o = s.overview;

    // Stat cards
    statsContainer.innerHTML = `
      <div class="stat-card">
        <span class="stat-label">Total Flights</span>
        <span class="stat-value">${o.total_flights}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Passengers</span>
        <span class="stat-value">${o.total_passengers}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Total Bookings</span>
        <span class="stat-value">${o.total_bookings}</span>
        <span class="stat-sub">${o.confirmed_bookings} confirmed</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Revenue</span>
        <span class="stat-value">₹${o.total_revenue.toLocaleString('en-IN')}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Cancellations</span>
        <span class="stat-value">${s.cancellations.total_cancellations || 0}</span>
        <span class="stat-sub">Refunds: ₹${(s.cancellations.total_refunds || 0).toLocaleString('en-IN')}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Tickets Issued</span>
        <span class="stat-value">${o.total_tickets}</span>
      </div>
    `;

    // Revenue by Cabin chart
    renderRevenueChart(s.revenue_by_cabin);

    // Occupancy chart
    renderOccupancyChart(s.flight_occupancy);

    // Booking status chart
    renderBookingStatusChart(s.booking_by_status);

  } catch (e) {
    emptyState(statsContainer, '❌', 'Error loading admin stats');
  }
}

function renderRevenueChart(data) {
  const container = document.getElementById('chart-revenue');
  if (!data || !data.length) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem">No revenue data</p>';
    return;
  }
  const max = Math.max(...data.map(d => d.revenue));
  container.innerHTML = `
    <div class="bar-chart">
      ${data.map((d, i) => {
        const h = max > 0 ? (d.revenue / max * 150) : 10;
        return `
          <div class="bar-group">
            <div class="bar-value">₹${d.revenue.toLocaleString('en-IN')}</div>
            <div class="bar gradient-${(i % 4) + 1}" style="height:${h}px"></div>
            <div class="bar-label">${d._id}<br>(${d.count})</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderOccupancyChart(data) {
  const container = document.getElementById('chart-occupancy');
  if (!data || !data.length) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem">No occupancy data</p>';
    return;
  }
  container.innerHTML = `
    <div class="bar-chart">
      ${data.map((f, i) => {
        const occ = f.economy_booked || 0;
        const occTotal = f.seats ? (f.seats.economy.total || 0) : 0;
        const busOcc = f.business_booked || 0;
        const busTotal = f.seats ? (f.seats.business.total || 0) : 0;
        const maxSeats = Math.max(occTotal, busTotal, 1);

        return `
          <div class="bar-group" style="gap:4px">
            <div class="bar-value">${occ} / ${busOcc}</div>
            <div style="display:flex;gap:3px;width:100%;align-items:flex-end;height:120px">
              <div class="bar gradient-2" style="height:${Math.max((occ / maxSeats) * 120, 8)}px;flex:1" title="Eco: ${occ}/${occTotal}"></div>
              <div class="bar gradient-1" style="height:${Math.max((busOcc / maxSeats) * 120, 8)}px;flex:1" title="Biz: ${busOcc}/${busTotal}"></div>
            </div>
            <div class="bar-label">${f.flight_number}<br>${f.origin_ref}→${f.destination_ref}</div>
          </div>
        `;
      }).join('')}
    </div>
    <div style="display:flex;gap:1rem;justify-content:center;margin-top:0.5rem">
      <span class="legend-item"><span class="legend-dot" style="background:var(--gradient-2)"></span> Economy</span>
      <span class="legend-item"><span class="legend-dot" style="background:var(--gradient-1)"></span> Business</span>
    </div>
  `;
}

function renderBookingStatusChart(data) {
  const container = document.getElementById('chart-bookings');
  if (!data || !data.length) {
    container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem">No booking data</p>';
    return;
  }
  const total = data.reduce((s, d) => s + d.count, 0);
  const colors = { confirmed: '#22c55e', cancelled: '#ef4444', pending: '#f59e0b' };

  // Build conic gradient
  let gradientParts = [];
  let cumPct = 0;
  data.forEach(d => {
    const pct = (d.count / total) * 100;
    gradientParts.push(`${colors[d._id] || '#666'} ${cumPct}% ${cumPct + pct}%`);
    cumPct += pct;
  });

  container.innerHTML = `
    <div class="donut-chart">
      <div class="donut-visual" style="background:conic-gradient(${gradientParts.join(',')})">
        <div class="donut-center">${total}</div>
      </div>
      <div class="donut-legend">
        ${data.map(d => `
          <div class="legend-item">
            <span class="legend-dot" style="background:${colors[d._id] || '#666'}"></span>
            <span>${d._id}: ${d.count} (₹${d.total_revenue.toLocaleString('en-IN')})</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  loadAirports();
  searchFlights();
});
