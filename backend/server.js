/**
 * backend/server.js
 *
 * Express entry point: middleware, static uploads, all API routes and the
 * central error handler.
 */

const path = require('path');

// Load backend/.env regardless of which folder the process was started from.
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');

const routes = require('./routes/route');
const { HttpError } = require('./controllers/userControllers/userController');

const app = express();
// `|| 5000` also covers an inherited PORT=0 / non-numeric value.
const PORT = Number(process.env.PORT) || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// The Next.js app calls this API from another origin, so allow exactly that origin.
app.use(cors({ origin: FRONTEND_URL }));
app.use(express.json());

// Uploaded profile pictures (public URLs like /uploads/<uuid>.jpg)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// All API routes live in routes/route.js
app.use('/api', routes);

app.get('/', (req, res) => {
  res.json({ ok: true, service: 'ERP Auth API' });
});

// Unknown route
app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
});

// Central error handler: every controller reports failures through next(error).
app.use((error, req, res, next) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }

  if (error && error.name === 'MulterError') {
    return res.status(400).json({
      error:
        error.code === 'LIMIT_FILE_SIZE'
          ? 'Profile picture must be 2 MB or smaller.'
          : 'Could not read the uploaded picture.',
    });
  }

  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ error: 'Invalid JSON body.' });
  }

  console.error('[api]', error);
  return res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
  console.log(`Allowing frontend origin ${FRONTEND_URL}`);
});
