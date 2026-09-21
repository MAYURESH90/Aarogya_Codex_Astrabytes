const { Consultation, Prescription, Report, Token, Consent, Patient, Document } = require('../models');
const AuditService = require('./AuditService');

class MedicalRecordService {
  /**
   * Verify patient consent or ownership before accessing medical records
   */
  static async verifyConsentOrOwnership({ patientId, requestingUserId, requestingRole, doctorId = null }) {
    // If requesting user is the patient themselves
    const patient = await Patient.findById(patientId);
    if (!patient) throw new Error('Patient record not found');

    if (requestingRole === 'PATIENT' && patient.userId && String(patient.userId) === String(requestingUserId)) {
      return true;
    }

    // Admins always have compliance audit access
    if (requestingRole === 'ADMIN') {
      return true;
    }

    // If Doctor or Staff, check active Consent
    const activeConsent = await Consent.findOne({
      patientId,
      status: 'GRANTED',
      expiresAt: { $gt: new Date() }
    });

    if (activeConsent) {
      return true;
    }

    // If doctor is currently assigned to patient's active consultation session
    if (requestingRole === 'DOCTOR' && doctorId) {
      const activeSessionToken = await Token.findOne({
        patientId,
        doctorId,
        status: { $in: ['IN_CONSULTATION', 'CALLED', 'COMPLETED'] }
      });
      if (activeSessionToken) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get unified clinical patient timeline
   */
  static async getPatientTimeline(patientId, requestingUser) {
    const isAuthorized = await this.verifyConsentOrOwnership({
      patientId,
      requestingUserId: requestingUser._id,
      requestingRole: requestingUser.role,
      doctorId: requestingUser.doctorId
    });

    if (!isAuthorized) {
      throw new Error('UNAUTHORIZED_MEDICAL_ACCESS: Active patient consent required to view clinical history.');
    }

    // Fetch visits / tokens
    const tokens = await Token.find({ patientId }).populate('opdId doctorId hospitalId').sort({ createdAt: -1 });
    const consultations = await Consultation.find({ patientId }).populate('doctorId').sort({ startedAt: -1 });
    const prescriptions = await Prescription.find({ patientId }).populate('doctorId').sort({ issuedAt: -1 });
    const reports = await Report.find({ patientId }).sort({ date: -1 });
    // BUG 1 FIX: include uploaded Document records in the timeline
    const documents = await Document.find({ patientId }).sort({ createdAt: -1 });

    // Aggregate into unified chronological timeline
    const timeline = [];

    for (const t of tokens) {
      timeline.push({
        type: 'OPD_VISIT',
        id: t._id,
        date: t.joinedAt,
        details: {
          tokenNumber: t.tokenNumber,
          opdName: t.opdId?.name,
          doctorName: t.doctorId?.name,
          hospitalName: t.hospitalId?.name,
          status: t.status
        }
      });
    }

    for (const c of consultations) {
      timeline.push({
        type: 'CONSULTATION',
        id: c._id,
        date: c.startedAt,
        details: {
          doctorName: c.doctorId?.name,
          symptoms: c.symptoms,
          diagnosis: c.diagnosis,
          durationMinutes: c.durationMinutes,
          clinicalNotes: c.clinicalNotes
        }
      });
    }

    for (const p of prescriptions) {
      timeline.push({
        type: 'PRESCRIPTION',
        id: p._id,
        date: p.issuedAt,
        details: {
          doctorName: p.doctorId?.name,
          medicines: p.medicines,
          advice: p.dietaryAdvice
        }
      });
    }

    for (const r of reports) {
      timeline.push({
        type: 'REPORT',
        id: r._id,
        date: r.date,
        details: {
          title: r.title,
          reportType: r.reportType,
          fileUrl: r.fileUrl,
          summary: r.summary
        }
      });
    }

    // BUG 1 FIX: add Document records
    for (const d of documents) {
      timeline.push({
        type: 'DOCUMENT_UPLOAD',
        id: d._id,
        date: d.createdAt,
        details: {
          title: d.originalName,
          ocrStatus: d.ocrStatus,
          ocrExtractedText: d.ocrExtractedText || null,
          extractedMedicines: d.ocrExtractedFields?.medicines || [],
          extractedInstructions: d.ocrExtractedFields?.instructions || [],
          mimeType: d.mimeType,
          fileSize: d.fileSize
        }
      });
    }

    // Sort descending by date
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Audit the medical record view
    await AuditService.log({
      actorId: requestingUser._id,
      actorRole: requestingUser.role,
      action: 'VIEW_PATIENT_TIMELINE',
      entity: 'PATIENT',
      entityId: String(patientId)
    });

    return timeline;
  }
}

module.exports = MedicalRecordService;
