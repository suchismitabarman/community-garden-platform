const express = require('express');
const { transact } = require('../data/store');

const router = express.Router();

const isEmail = (v) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// POST /api/volunteer
// body: { name, email, interests, message }
router.post('/volunteer', async (req, res) => {
  const { name, email, interests, message } = req.body || {};

  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });
  if (!isEmail(email)) return res.status(400).json({ error: 'A valid email is required.' });

  try {
    const entry = await transact((data) => {
      const record = {
        id: `vol-${Date.now()}`,
        name: name.trim(),
        email: email.trim(),
        interests: Array.isArray(interests) ? interests : [],
        message: (message || '').trim(),
        createdAt: new Date().toISOString(),
      };
      data.volunteers.push(record);
      return record;
    });
    res.status(201).json({ volunteer: entry });
  } catch (err) {
    res.status(500).json({ error: 'Could not save your details. Try again.' });
  }
});

// POST /api/subscribe
// body: { email }
router.post('/subscribe', async (req, res) => {
  const { email } = req.body || {};
  if (!isEmail(email)) return res.status(400).json({ error: 'A valid email is required.' });

  try {
    const result = await transact((data) => {
      const exists = data.subscribers.some((s) => s.email.toLowerCase() === email.trim().toLowerCase());
      if (exists) return { status: 200, body: { message: 'Already subscribed.' } };
      data.subscribers.push({ email: email.trim(), createdAt: new Date().toISOString() });
      return { status: 201, body: { message: 'Subscribed.' } };
    });
    res.status(result.status).json(result.body);
  } catch (err) {
    res.status(500).json({ error: 'Could not subscribe. Try again.' });
  }
});

module.exports = router;
