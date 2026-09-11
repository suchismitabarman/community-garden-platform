// Lightweight file-backed JSON store. No native dependencies, so it runs
// anywhere Node runs. Fine for a garden's scale of data (dozens of plots,
// a few hundred members). Writes are queued so concurrent requests can't
// clobber each other.

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

function seed() {
  const plotSizes = [
    { size: 'small', label: 'Small (4x4 ft)', priceLabel: '$20 / season' },
    { size: 'medium', label: 'Medium (4x8 ft)', priceLabel: '$35 / season' },
    { size: 'large', label: 'Large (8x8 ft)', priceLabel: '$55 / season' },
  ];

  const rows = 4;
  const cols = 6;
  const plots = [];
  let n = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sizeIdx = (r + c) % 3;
      plots.push({
        id: `plot-${n}`,
        code: String(n).padStart(2, '0'),
        row: r,
        col: c,
        size: plotSizes[sizeIdx].size,
        sizeLabel: plotSizes[sizeIdx].label,
        priceLabel: plotSizes[sizeIdx].priceLabel,
        sunExposure: (r + c) % 2 === 0 ? 'full sun' : 'partial shade',
        nearWater: c === 0 || c === cols - 1,
        status: 'available', // available | reserved
        reservedBy: null,
      });
      n++;
    }
  }

  // Reserve a few so the map doesn't look empty on first load.
  [2, 7, 13, 19].forEach((num) => {
    const p = plots.find((pl) => pl.code === String(num).padStart(2, '0'));
    if (p) {
      p.status = 'reserved';
      p.reservedBy = 'A neighbor';
    }
  });

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  return {
    plots,
    reservations: [],
    events: [
      {
        id: 'evt-1',
        title: 'Spring Bed Turning',
        description:
          'Bring a fork and gloves. We\'ll turn compost into the beds before the first plantings go in.',
        date: new Date(now + 6 * day).toISOString(),
        location: 'Main gate, tool shed',
        capacity: 25,
        rsvps: [],
      },
      {
        id: 'evt-2',
        title: 'Seed Swap',
        description:
          'Trade saved seeds with other growers. Bring what you have, take what you need — no obligation either way.',
        date: new Date(now + 13 * day).toISOString(),
        location: 'Community table',
        capacity: 40,
        rsvps: [],
      },
      {
        id: 'evt-3',
        title: 'Kids\' Planting Morning',
        description:
          'A slow, hands-in-the-dirt morning for younger gardeners. Sunflowers and radishes, mostly.',
        date: new Date(now + 20 * day).toISOString(),
        location: 'Plots 1–6',
        capacity: 15,
        rsvps: [],
      },
    ],
    volunteers: [],
    subscribers: [],
  };
}

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(seed(), null, 2));
  }
}

function read() {
  ensureDb();
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

let writeQueue = Promise.resolve();

function write(data) {
  writeQueue = writeQueue.then(
    () =>
      new Promise((resolve, reject) => {
        fs.writeFile(DB_PATH, JSON.stringify(data, null, 2), (err) => {
          if (err) reject(err);
          else resolve();
        });
      })
  );
  return writeQueue;
}

// Runs `mutator(data)` and persists the result. Keeps read-modify-write
// atomic with respect to other calls through this function.
async function transact(mutator) {
  ensureDb();
  const data = read();
  const result = mutator(data);
  await write(data);
  return result;
}

module.exports = { read, write, transact };
