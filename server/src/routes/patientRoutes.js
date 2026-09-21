const express = require('express');
const router = express.Router();
const PatientController = require('../controllers/PatientController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/me', authMiddleware, PatientController.getMyProfile);
router.put('/me', authMiddleware, PatientController.updateMyProfile);

module.exports = router;
