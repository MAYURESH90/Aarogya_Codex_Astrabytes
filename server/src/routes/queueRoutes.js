const express = require('express');
const router = express.Router();
const QueueController = require('../controllers/QueueController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Live unified queue view (Staff, Doctor, Admin)
router.get('/:sessionId/live', authMiddleware, QueueController.getLiveQueue);

// Doctor consultation controls
router.post('/:sessionId/call-next', authMiddleware, roleMiddleware('DOCTOR', 'STAFF'), QueueController.callNext);
router.post('/:sessionId/consultation-start', authMiddleware, roleMiddleware('DOCTOR'), QueueController.startConsultation);
router.post('/:sessionId/consultation-complete', authMiddleware, roleMiddleware('DOCTOR'), QueueController.completeConsultation);

// Emergency priority token insertion
router.post('/:sessionId/emergency', authMiddleware, roleMiddleware('STAFF', 'ADMIN', 'DOCTOR'), QueueController.addEmergency);

// Operational delays & early finish
router.post('/:sessionId/doctor-delay', authMiddleware, roleMiddleware('DOCTOR', 'STAFF'), QueueController.reportDoctorDelay);
router.post('/:sessionId/doctor-early-finish', authMiddleware, roleMiddleware('DOCTOR', 'STAFF'), QueueController.reportDoctorEarlyFinish);

// Smart No-Show & Re-entry
router.post('/:sessionId/no-show', authMiddleware, roleMiddleware('STAFF', 'DOCTOR'), QueueController.handleNoShow);
router.post('/:sessionId/re-entry', authMiddleware, roleMiddleware('STAFF'), QueueController.handleReentry);

// Staff Queue Override with mandatory reason
router.post('/:sessionId/override', authMiddleware, roleMiddleware('STAFF', 'ADMIN'), QueueController.staffOverride);

module.exports = router;
