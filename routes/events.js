const express = require('express');
const { read, transact } = require('../data/store');

const router = express.Router();

// GET /api/events
router.get('/', (req, res) => {
  const { events } = read();
  const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
  const withCounts = sorted.map((e) => ({
    ...e,
    rsvpCount: e.rsvps.length,
    spotsLeft: Math.max(e.capacity - e.rsvps.length, 0),
  }));
  res.json(withCounts);
});

// POST /api/events/:id/rsvp
// body: { name, email, guests }
router.post('/:id/rsvp', async (req, res) => {
  const { name, email, guests } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required.' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }

  const guestCount = Math.max(0, Math.min(10, parseInt(guests, 10) || 0));

  try {
    const result = await transact((data) => {
      const event = data.events.find((e) => e.id === req.params.id);
      if (!event) {
        return { status: 404, body: { error: 'No event with that id.' } };
      }
      if (event.rsvps.some((r) => r.email.toLowerCase() === email.trim().toLowerCase())) {
        return { status: 409, body: { error: 'That email already RSVP\'d for this event.' } };
      }
      const spotsLeft = event.capacity - event.rsvps.length;
      if (spotsLeft <= 0) {
        return { status: 409, body: { error: 'This event is full.' } };
      }

      event.rsvps.push({
        name: name.trim(),
        email: email.trim(),
        guests: guestCount,
        createdAt: new Date().toISOString(),
      });

      return {
        status: 201,
        body: {
          event: { ...event, rsvpCount: event.rsvps.length, spotsLeft: event.capacity - event.rsvps.length },
        },
      };
    });

    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(500).json({ error: 'Could not save the RSVP. Try again.' });
  }
});

module.exports = router;
