const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const routes = require('./routes');
const healthRoutes = require('./routes/healthRoutes');
const errorHandler = require('./middleware/errorHandler');
const env = require('./config/env');

const app = express();

// Security and utility middlewares
app.use(helmet({
  contentSecurityPolicy: false // Allows Swagger UI to render assets
}));
app.use(cors({ origin: true, credentials: true }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads directory
app.use('/uploads', express.static(env.UPLOAD_DIR));

// OpenAPI / Swagger Documentation UI
try {
  const swaggerDocument = YAML.load(path.join(__dirname, 'docs/openapi.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  console.log('[Docs] Swagger OpenAPI documentation available at /api-docs');
} catch (e) {
  console.warn('[Docs] Could not load openapi.yaml for Swagger UI:', e.message);
}

// Health checks mounted at root /health
app.use('/health', healthRoutes);

// Core API endpoints mounted at /api
app.use('/api', routes);

// 404 Route Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `The requested endpoint ${req.method} ${req.originalUrl} was not found.`
    }
  });
});

// Central Error Handler
app.use(errorHandler);

module.exports = app;
