const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const PatientAuthController = require('../controllers/PatientAuthController');

// Existing unified auth routes (keep for Staff/Admin or backwards compatibility)
router.post('/register', AuthController.register);
router.post('/request-otp', AuthController.requestOtp);
router.post('/verify-otp', AuthController.verifyOtp);
router.post('/login', AuthController.loginWithPassword);

// New Patient Auth Routes with Twilio Verify
router.post('/patient/register', PatientAuthController.register);
router.post('/patient/send-otp', PatientAuthController.sendOtp);
router.post('/patient/verify-otp', PatientAuthController.verifyOtp);

module.exports = router;
