const { Consultation, Prescription, Report, Consent, Document, Patient } = require('../models');
const MedicalRecordService = require('../services/MedicalRecordService');
const OCRService = require('../services/OCRService');
const AuditService = require('../services/AuditService');

class MedicalController {
  /**
   * Get Patient Clinical Timeline with consent enforcement
   */
  static async getTimeline(req, res, next) {
    try {
      const patientId = req.params.patientId || req.user.patientId;
      if (!patientId) {
        return res.status(400).json({
          success: false,
          error: { code: 'PATIENT_ID_REQUIRED', message: 'patientId is required.' }
        });
      }

      const timeline = await MedicalRecordService.getPatientTimeline(patientId, req.user);
      res.json({
        success: true,
        data: timeline
      });
    } catch (error) {
      if (error.message && error.message.includes('UNAUTHORIZED_MEDICAL_ACCESS')) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'CONSENT_REQUIRED',
            message: 'Active patient consent is required to access medical records.'
          }
        });
      }
      next(error);
    }
  }

  /**
   * Doctor records Consultation
   */
  static async createConsultation(req, res, next) {
    try {
      const {
        tokenId,
        patientId,
        sessionId,
        symptoms,
        diagnosis,
        clinicalNotes,
        startedAt,
        endedAt,
        durationMinutes,
        followUpDate
      } = req.body;

      const consultation = new Consultation({
        tokenId,
        patientId,
        doctorId: req.user.doctorId,
        sessionId,
        symptoms: symptoms || [],
        diagnosis,
        clinicalNotes,
        startedAt: startedAt || new Date(Date.now() - 8 * 60000),
        endedAt: endedAt || new Date(),
        durationMinutes: durationMinutes || 8,
        followUpDate
      });

      await consultation.save();

      await AuditService.log({
        actorId: req.user._id,
        actorRole: 'DOCTOR',
        action: 'CONSULTATION_RECORDED',
        entity: 'CONSULTATION',
        entityId: String(consultation._id)
      });

      res.status(201).json({
        success: true,
        data: consultation
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Doctor creates Prescription
   */
  static async createPrescription(req, res, next) {
    try {
      const {
        consultationId,
        patientId,
        medicines,
        dietaryAdvice,
        testsPrescribed
      } = req.body;

      const prescription = new Prescription({
        consultationId,
        patientId,
        doctorId: req.user.doctorId,
        medicines: medicines || [],
        dietaryAdvice,
        testsPrescribed
      });

      await prescription.save();

      res.status(201).json({
        success: true,
        data: prescription
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Patient grants or updates Consent
   */
  static async grantConsent(req, res, next) {
    try {
      const { patientId, doctorId, hospitalId, purpose, durationDays = 30 } = req.body;

      const consent = new Consent({
        patientId: patientId || req.user.patientId,
        doctorId: doctorId || null,
        hospitalId: hospitalId || null,
        purpose: purpose || 'OPD_CONSULTATION',
        status: 'GRANTED',
        grantedAt: new Date(),
        expiresAt: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
      });

      await consent.save();

      await AuditService.log({
        actorId: req.user._id,
        actorRole: req.user.role,
        action: 'CONSENT_GRANTED',
        entity: 'CONSENT',
        entityId: String(consent._id)
      });

      res.status(201).json({
        success: true,
        data: consent
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Patient revokes Consent
   */
  static async revokeConsent(req, res, next) {
    try {
      const consent = await Consent.findById(req.params.consentId);
      if (!consent) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Consent record not found.' }
        });
      }

      consent.status = 'REVOKED';
      await consent.save();

      await AuditService.log({
        actorId: req.user._id,
        actorRole: req.user.role,
        action: 'CONSENT_REVOKED',
        entity: 'CONSENT',
        entityId: String(consent._id)
      });

      res.json({
        success: true,
        message: 'Consent successfully revoked.'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload Document and run OCR processing (Section 41 & 43)
   */
  static async uploadDocument(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { code: 'FILE_REQUIRED', message: 'Please upload a medical document file.' }
        });
      }

      let targetPatientId;

      if (req.user.role === 'PATIENT') {
        // BUG 2 FIX: For patients, ALWAYS derive patientId from the authenticated user.
        // Never trust a patientId supplied by the frontend — this prevents cross-patient upload.
        const patientRecord = await Patient.findOne({ userId: req.user._id });
        if (!patientRecord) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'PATIENT_RECORD_NOT_FOUND',
              message: 'No patient profile is linked to your account. Please complete your profile first.'
            }
          });
        }
        targetPatientId = patientRecord._id;
      } else {
        // Staff / Doctor / Admin: may upload on behalf of a patient (existing authorised behaviour).
        // Require an explicit patientId in this case.
        const { patientId } = req.body;
        if (!patientId) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'PATIENT_ID_REQUIRED',
              message: 'patientId is required when uploading on behalf of a patient.'
            }
          });
        }
        targetPatientId = patientId;
      }

      // Extract text via OCR abstraction
      const ocrResult = await OCRService.extractText(req.file.path, req.file.mimetype);
      const structuredFields = ocrResult.success ? await OCRService.extractStructuredMedicalFields(ocrResult.rawText) : {};

      const doc = new Document({
        patientId: targetPatientId,
        uploadedBy: req.user._id,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        storagePath: req.file.path,
        ocrStatus: ocrResult.success ? 'PROCESSED' : 'FAILED',
        ocrExtractedText: ocrResult.rawText || null,
        ocrExtractedFields: structuredFields
      });

      await doc.save();

      res.status(201).json({
        success: true,
        data: doc
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = MedicalController;
