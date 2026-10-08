const serverless = require('serverless-http');
const { app } = require('../app');
const { connectDB } = require('../config/database');

const handler = serverless(app);

let dbReady = false;
let connecting = null;

const ensureDB = async () => {
  if (dbReady || mongooseConnected()) return true;
  if (!connecting) {
    connecting = connectDB()
      .then(() => {
        dbReady = true;
        return true;
      })
      .catch((err) => {
        dbReady = false;
        throw err;
      })
      .finally(() => {
        connecting = null;
      });
  }
  return connecting;
};

const mongooseConnected = () => {
  try {
    return require('mongoose').connection.readyState === 1;
  } catch {
    return false;
  }
};

module.exports = async (req, res) => {
  try {
    await ensureDB();
  } catch (err) {
    if (!res.headersSent) {
      return res.status(503).json({
        status: 'error',
        message: 'Service temporarily unavailable. Please try again shortly.',
      });
    }
  }
  return handler(req, res);
};
