const express = require('express');
const { read, transact } = require('../data/store');

const router = express.Router();

// GET /api/plots — full plot map
router.get('/', (req, res) => {
  const { plots } = read();
  res.json(plots);
});

// GET /api/plots/:id
router.get('/:id', (req, res) => {
  const { plots } = read();
  const plot = plots.find((p) => p.id === req.params.id);
  if (!plot) return res.status(404).json({ error: 'No plot with that id.' });
  res.json(plot);
});

// POST /api/plots/:id/reserve
// body: { name, email, note }
router.post('/:id/reserve', async (req, res) => {
  const { name, email, note } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required.' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }

  try {
    const result = await transact((data) => {
      const plot = data.plots.find((p) => p.id === req.params.id);
      if (!plot) {
        return { status: 404, body: { error: 'No plot with that id.' } };
      }
      if (plot.status === 'reserved') {
        return { status: 409, body: { error: 'That plot was just reserved by someone else.' } };
      }

      plot.status = 'reserved';
      plot.reservedBy = name.trim();

      const reservation = {
        id: `res-${Date.now()}`,
        plotId: plot.id,
        plotCode: plot.code,
        name: name.trim(),
        email: email.trim(),
        note: (note || '').trim(),
        createdAt: new Date().toISOString(),
      };
      data.reservations.push(reservation);

      return { status: 201, body: { plot, reservation } };
    });

    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(500).json({ error: 'Could not save the reservation. Try again.' });
  }
});

// POST /api/plots/:id/release — free up a plot (e.g. admin/cancel flow)
router.post('/:id/release', async (req, res) => {
  try {
    const result = await transact((data) => {
      const plot = data.plots.find((p) => p.id === req.params.id);
      if (!plot) {
        return { status: 404, body: { error: 'No plot with that id.' } };
      }
      plot.status = 'available';
      plot.reservedBy = null;
      return { status: 200, body: { plot } };
    });
    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(500).json({ error: 'Could not release the plot. Try again.' });
  }
});

module.exports = router;
