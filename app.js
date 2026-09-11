(() => {
  const API = '/api';
  let plots = [];
  let selectedPlotId = null;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function showToast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { el.hidden = true; }, 3200);
  }

  async function api(path, options) {
    const res = await fetch(API + path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    let body = null;
    try { body = await res.json(); } catch (_) { /* no body */ }
    if (!res.ok) {
      const message = (body && body.error) || 'Something went wrong.';
      throw new Error(message);
    }
    return body;
  }

  /* --------------------------- Plot map --------------------------- */

  function renderStats() {
    const availEl = $('#stat-available');
    const reservedEl = $('#stat-reserved');
    if (!availEl || !reservedEl) return; // only present on the home page
    const available = plots.filter((p) => p.status === 'available').length;
    const reserved = plots.length - available;
    availEl.textContent = available;
    reservedEl.textContent = reserved;
  }

  function renderPeek() {
    const grid = $('#hero-peek-grid');
    if (!grid) return; // only present on the home page
    grid.innerHTML = '';
    plots.forEach((p) => {
      const cell = document.createElement('div');
      cell.className = 'peek-cell' + (p.status === 'reserved' ? ' is-reserved' : '');
      grid.appendChild(cell);
    });
  }

  function renderMap() {
    const map = $('#plot-map');
    if (!map) return; // only present on the plots page
    map.innerHTML = '';
    plots.forEach((p) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'plot' + (p.status === 'reserved' ? ' is-reserved' : '') + (p.id === selectedPlotId ? ' is-selected' : '');
      btn.dataset.plotId = p.id;
      btn.setAttribute('aria-pressed', p.id === selectedPlotId ? 'true' : 'false');
      btn.setAttribute(
        'aria-label',
        `Plot ${p.code}, ${p.sizeLabel}, ${p.status === 'reserved' ? 'claimed' : 'available'}`
      );
      btn.textContent = p.code;
      btn.addEventListener('click', () => selectPlot(p.id));
      map.appendChild(btn);
    });
  }

  function selectPlot(id) {
    selectedPlotId = id;
    renderMap();
    renderDetail();
  }

  function renderDetail() {
    const panel = $('#plot-detail');
    if (!panel) return; // only present on the plots page
    const plot = plots.find((p) => p.id === selectedPlotId);
    if (!plot) { panel.hidden = true; return; }

    panel.hidden = false;
    $('#detail-code').textContent = `Plot ${plot.code}`;
    $('#detail-size').textContent = plot.sizeLabel;

    const facts = $('#detail-facts');
    facts.innerHTML = `
      <li><strong>${plot.priceLabel}</strong></li>
      <li>${plot.sunExposure}</li>
      <li>${plot.nearWater ? 'near the water spigot' : 'a short hose run from water'}</li>
    `;

    const availablePanel = $('#detail-available-panel');
    const reservedPanel = $('#detail-reserved-panel');

    if (plot.status === 'reserved') {
      availablePanel.hidden = true;
      reservedPanel.hidden = false;
      $('#detail-reserved-by').textContent = plot.reservedBy || 'someone';
    } else {
      availablePanel.hidden = false;
      reservedPanel.hidden = true;
      $('#reserve-note').textContent = '';
      $('#reserve-note').className = 'form-note';
    }

    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function loadPlots() {
    try {
      plots = await api('/plots');
      renderStats();
      renderPeek();
      renderMap();
    } catch (err) {
      const map = $('#plot-map');
      if (map) map.innerHTML = `<p class="loading-note">Couldn't load the map. Refresh to try again.</p>`;
    }
  }

  const detailCloseBtn = $('#detail-close');
  if (detailCloseBtn) {
    detailCloseBtn.addEventListener('click', () => {
      selectedPlotId = null;
      renderMap();
      renderDetail();
    });
  }

  const reserveForm = $('#reserve-form');
  if (reserveForm) {
    reserveForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const note = $('#reserve-note');
      const submitBtn = form.querySelector('button[type="submit"]');
      const payload = {
        name: form.name.value,
        email: form.email.value,
        note: form.note.value,
      };

      submitBtn.disabled = true;
      note.textContent = 'Saving…';
      note.className = 'form-note';

      try {
        const { plot } = await api(`/plots/${selectedPlotId}/reserve`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        const idx = plots.findIndex((p) => p.id === plot.id);
        if (idx !== -1) plots[idx] = plot;
        renderStats();
        renderPeek();
        renderMap();
        renderDetail();
        form.reset();
        showToast(`Plot ${plot.code} is yours. See you in the garden.`);
      } catch (err) {
        note.textContent = err.message;
        note.className = 'form-note is-error';
        if (err.message.includes('just reserved')) {
          await loadPlots();
          renderDetail();
        }
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  /* --------------------------- Events --------------------------- */

  function formatEventDate(iso) {
    const d = new Date(iso);
    return {
      day: d.toLocaleDateString(undefined, { day: 'numeric' }),
      month: d.toLocaleDateString(undefined, { month: 'short' }),
      full: d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    };
  }

  function eventRowTemplate(ev) {
    const date = formatEventDate(ev.date);
    const full = ev.spotsLeft <= 0;
    return `
      <div class="event-row" data-event-id="${ev.id}">
        <div class="event-date">
          <span class="day">${date.day}</span>
          <span class="month">${date.month}</span>
        </div>
        <div class="event-body">
          <h3>${ev.title}</h3>
          <p class="event-meta">${date.full} · ${ev.location}</p>
          <p class="event-desc">${ev.description}</p>
        </div>
        <div class="event-rsvp">
          <form class="rsvp-form" data-event-id="${ev.id}">
            <input type="text" name="name" placeholder="Name" required ${full ? 'disabled' : ''} />
            <input type="email" name="email" placeholder="Email" required ${full ? 'disabled' : ''} />
            <button type="submit" class="btn btn-ghost" ${full ? 'disabled' : ''}>${full ? 'Full' : 'RSVP'}</button>
            <p class="spots-left ${full ? 'is-full' : ''}">${full ? 'No spots left' : `${ev.spotsLeft} of ${ev.capacity} spots left`}</p>
            <p class="form-note"></p>
          </form>
        </div>
      </div>
    `;
  }

  async function loadEvents() {
    const list = $('#events-list');
    if (!list) return; // only present on the events page
    try {
      const events = await api('/events');
      list.innerHTML = events.map(eventRowTemplate).join('');

      $$('.rsvp-form', list).forEach((form) => {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const note = $('.form-note', form);
          const submitBtn = form.querySelector('button[type="submit"]');
          submitBtn.disabled = true;
          note.textContent = 'Saving…';
          note.className = 'form-note';
          try {
            await api(`/events/${form.dataset.eventId}/rsvp`, {
              method: 'POST',
              body: JSON.stringify({ name: form.name.value, email: form.email.value }),
            });
            showToast('You\'re on the list.');
            await loadEvents();
          } catch (err) {
            note.textContent = err.message;
            note.className = 'form-note is-error';
            submitBtn.disabled = false;
          }
        });
      });
    } catch (err) {
      list.innerHTML = `<p class="loading-note">Couldn't load events. Refresh to try again.</p>`;
    }
  }

  /* --------------------------- Volunteer & subscribe --------------------------- */

  const volunteerForm = $('#volunteer-form');
  if (volunteerForm) {
    volunteerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const note = $('#volunteer-note');
      const submitBtn = form.querySelector('button[type="submit"]');
      const interests = $$('input[name="interests"]:checked', form).map((i) => i.value);

      submitBtn.disabled = true;
      note.textContent = 'Sending…';
      note.className = 'form-note';

      try {
        await api('/volunteer', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name.value,
            email: form.email.value,
            interests,
            message: form.message.value,
          }),
        });
        note.textContent = 'Thanks — we\'ll be in touch.';
        note.className = 'form-note is-ok';
        form.reset();
      } catch (err) {
        note.textContent = err.message;
        note.className = 'form-note is-error';
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  const subscribeForm = $('#subscribe-form');
  if (subscribeForm) {
    subscribeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const note = $('#subscribe-note');
      const submitBtn = form.querySelector('button[type="submit"]');

      submitBtn.disabled = true;
      note.textContent = 'Saving…';
      note.className = 'form-note';

      try {
        await api('/subscribe', { method: 'POST', body: JSON.stringify({ email: form.email.value }) });
        note.textContent = 'You\'re subscribed.';
        note.className = 'form-note is-ok';
        form.reset();
      } catch (err) {
        note.textContent = err.message;
        note.className = 'form-note is-error';
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  /* --------------------------- Boot --------------------------- */

  if ($('#plot-map') || $('#hero-peek-grid')) loadPlots();
  if ($('#events-list')) loadEvents();
})();
