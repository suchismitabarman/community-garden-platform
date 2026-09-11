const path = require('path');
const express = require('express');
const cors = require('cors');

const plotsRouter = require('./routes/plots');
const eventsRouter = require('./routes/events');
const communityRouter = require('./routes/community');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API
app.use('/api/plots', plotsRouter);
app.use('/api/events', eventsRouter);
app.use('/api', communityRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Frontend (static, built as plain HTML/CSS/JS — no build step needed).
// It's a small multi-page site, so each page is its own file, cross-linked
// through the shared nav/footer and contextual links within the copy.
app.use(express.static(path.join(__dirname, 'public')));

// Clean URLs for the pages that live behind *.html on disk.
const pages = { plots: 'plots.html', events: 'events.html', volunteer: 'volunteer.html', join: 'join.html' };
Object.entries(pages).forEach(([route, file]) => {
  app.get(`/${route}`, (req, res) => res.sendFile(path.join(__dirname, 'public', file)));
});

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'No route here.' });
  }
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our end.' });
});

app.listen(PORT, () => {
  console.log(`Community garden platform running on http://localhost:${PORT}`);
});
