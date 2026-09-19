const express = require('express');
const router = express.Router();
const IVRController = require('../controllers/IVRController');

// Twilio Voice IVR Webhook endpoint
router.post('/webhook', IVRController.handleVoiceQuery);
router.get('/webhook', IVRController.handleVoiceQuery);

module.exports = router;
