const express = require('express');
const router = express.Router();
const HealthController = require('../controllers/HealthController');

router.get('/', HealthController.getHealth);
router.get('/db', HealthController.getDbHealth);
router.get('/redis', HealthController.getRedisHealth);
router.get('/prediction', HealthController.getPredictionHealth);
router.get('/twilio', HealthController.getTwilioHealth);

module.exports = router;
