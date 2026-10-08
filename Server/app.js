const mongoose = require('mongoose');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');

const logger = require('./config/logger');
const { connectDB } = require('./config/database');
const { globalErrorHandler, notFoundHandler } = require('./middleware/errorHandler');
const apiRoutes = require('./routes/api');

const app = express();

app.enable('trust proxy');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(compression());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    status: 'fail',
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

app.use(mongoSanitize());
app.use(xss());
app.use(hpp({
  whitelist: ['page', 'limit', 'sort', 'fields'],
}));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev', { stream: logger.stream }));
} else {
  app.use(morgan('combined', { stream: logger.stream }));
}

app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  
  res.status(200).json({
    status: 'success',
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    database: {
      status: dbStatusMap[dbStatus] || 'unknown',
      host: mongoose.connection.host || 'N/A',
      name: mongoose.connection.name || 'N/A',
    },
  });
});

app.get('/api', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  
  res.json({
    status: 'success',
    message: 'Welcome to DocFix API',
    version: '1.0.0',
    documentation: '/api/docs',
    database: {
      status: dbStatusMap[dbStatus] || 'unknown',
      host: mongoose.connection.host || 'N/A',
      name: mongoose.connection.name || 'N/A',
    },
  });
});

app.use('/api/v1', apiRoutes);

app.use(notFoundHandler);

app.use(globalErrorHandler);

const startServer = async () => {
  try {
    await connectDB();
    
    const PORT = process.env.PORT || 8080;
    
    const server = app.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API base: http://localhost:${PORT}/api/v1`);
    });

    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received, shutting down gracefully`);
      server.close(async () => {
        logger.info('HTTP server closed');
        const { disconnectDB } = require('./config/database');
        await disconnectDB();
        process.exit(0);
      });
      
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

module.exports = { app, startServer };