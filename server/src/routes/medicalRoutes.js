const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const MedicalController = require('../controllers/MedicalController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const env = require('../config/env');

// Configure Multer storage
if (!fs.existsSync(env.UPLOAD_DIR)) {
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, env.UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `doc-${Date.now()}-${Math.floor(Math.random() * 10000)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB max
});

// Patient Timeline
router.get('/timeline/:patientId?', authMiddleware, MedicalController.getTimeline);

// Consultations & Prescriptions
router.post('/consultations', authMiddleware, roleMiddleware('DOCTOR'), MedicalController.createConsultation);
router.post('/prescriptions', authMiddleware, roleMiddleware('DOCTOR'), MedicalController.createPrescription);

// Consents
router.post('/consents', authMiddleware, MedicalController.grantConsent);
router.delete('/consents/:consentId', authMiddleware, MedicalController.revokeConsent);

// Document upload & OCR
router.post('/documents/upload', authMiddleware, upload.single('document'), MedicalController.uploadDocument);

module.exports = router;
