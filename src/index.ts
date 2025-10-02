import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import { connectDB, disconnectDB } from './utils/db';
import logger from './utils/logger';
import apiRouter from './routes';

dotenv.config();

const app = express();

// Middlewares de seguridad y parsing
app.use(helmet());
app.use(compression());

// Configuración de CORS optimizada para producción
const corsOptions = {
  origin: (origin: any, callback: any) => {
    const corsOriginEnv = process.env.CORS_ORIGIN || 'http://localhost:5173';
    const allowedOrigins = corsOriginEnv.split(',').map(o => o.trim().replace(/\/$/, ''));
    
    // Permitir requests sin origin en desarrollo (Postman, apps móviles)
    if (!origin && process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Normalizar origin
    const normalizedOrigin = origin?.replace(/\/$/, '');
    
    if (allowedOrigins.includes(normalizedOrigin)) {
      callback(null, true);
    } else {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`CORS: Origin no permitido: ${origin}`);
      }
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // Cache preflight requests for 24 hours
};

app.use(cors(corsOptions));
// Capture raw body for debugging/parsing when necessary (keeps parsed JSON too)
app.use(express.json({
  limit: '10kb',
  verify: (req: any, _res, buf: Buffer) => {
    try {
      req.rawBody = buf && buf.length ? buf.toString('utf8') : '';
    } catch (e) {
      req.rawBody = undefined;
    }
  }
}));

// Logging de requests
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiter configurado según el entorno
const isDevelopment = process.env.NODE_ENV !== 'production';
const limiter = rateLimit({
  windowMs: isDevelopment ? 1 * 60 * 1000 : 15 * 60 * 1000, // 1 min en dev, 15 min en prod
  max: isDevelopment ? 1000 : 100, // 1000 requests en dev, 100 en prod
  message: {
    error: 'Too many requests from this IP',
    retryAfter: isDevelopment ? '1 minute' : '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Excluir health check del rate limiting
  skip: (req) => req.path === '/api/health' || req.path === '/'
});
app.use(limiter);

// API routes
app.use('/api', apiRouter);

// Health check endpoint para Render
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Health / root
app.get('/', (req, res) => res.send('Servidor backend activo'));

const PORT = Number(process.env.PORT) || 4000;

async function start() {
  try {
    if (process.env.SKIP_DB === 'true') {
      logger.info('SKIP_DB=true -> no se intentará conectar a MongoDB (modo prueba)');
    } else {
      await connectDB();
      logger.info('DB conectada');
    }

    // Intentar escuchar en el puerto, con reintentos si está en uso
    const maxRetries = 5;
    let attempts = 0;
    let currentServer: any = null;
    let shutdownRegistered = false;

    const registerShutdown = () => {
      if (shutdownRegistered) return;
      shutdownRegistered = true;
      const shutdown = async () => {
        logger.info('Shutting down...');
        try {
          if (currentServer && typeof currentServer.close === 'function') {
            await new Promise<void>((resolve, reject) => {
              currentServer.close((err: any) => {
                if (err) return reject(err);
                resolve();
              });
            });
          }
        } catch (err) {
          logger.error('Error closing server: %o', err);
        }
        await disconnectDB();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    };

    const tryListen = (port: number) => {
      attempts += 1;
      try {
        currentServer = app.listen(port, () => logger.info(`Server listening on port ${port}`));
      } catch (err: any) {
        logger.warn('Listen threw error on port %d: %o', port, err);
        if (err && err.code === 'EADDRINUSE') {
          logger.warn('Port %d in use, attempt %d/%d', port, attempts, maxRetries);
          if (attempts < maxRetries) {
            return tryListen(port + 1);
          }
          logger.error('All port retry attempts failed. Exiting.');
          disconnectDB().finally(() => process.exit(1));
        } else {
          logger.error('Unexpected listen error: %o', err);
          disconnectDB().finally(() => process.exit(1));
        }
        return;
      }

      // handle async 'error' events on the server
      currentServer.on('error', (err: any) => {
        if (err && err.code === 'EADDRINUSE') {
          logger.warn('Port %d in use (async), attempt %d/%d', port, attempts, maxRetries);
          // Do not call close() on a server that never started; just try next port
          if (attempts < maxRetries) {
            tryListen(port + 1);
            return;
          }
          logger.error('All port retry attempts failed. Exiting.');
          disconnectDB().finally(() => process.exit(1));
        } else {
          logger.error('Server error: %o', err);
          disconnectDB().finally(() => process.exit(1));
        }
      });

      registerShutdown();
    };

    tryListen(PORT);
  } catch (err) {
    logger.error('Startup error: %o', err);
    process.exit(1);
  }
}

start();
