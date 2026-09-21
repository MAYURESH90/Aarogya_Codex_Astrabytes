const { Patient } = require('../models');

class PatientController {
  /**
   * Get current patient profile
   * GET /api/patients/me
   */
  static async getMyProfile(req, res, next) {
    try {
      if (req.user.role !== 'PATIENT') {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only patients can access this route.' } });
      }

      const patient = await Patient.findOne({ userId: req.user.id });
      if (!patient) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Patient profile not found.' } });
      }

      res.json({ success: true, data: patient });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update current patient profile
   * PUT /api/patients/me
   */
  static async updateMyProfile(req, res, next) {
    try {
      if (req.user.role !== 'PATIENT') {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only patients can access this route.' } });
      }

      const { name, dateOfBirth, gender, address, emergencyContact } = req.body;

      const patient = await Patient.findOne({ userId: req.user.id });
      if (!patient) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Patient profile not found.' } });
      }

      if (name) patient.name = name;
      if (dateOfBirth) patient.dateOfBirth = dateOfBirth;
      if (gender) patient.gender = gender;
      if (address) {
        patient.address = { ...patient.address, ...address };
      }
      if (emergencyContact) {
        patient.emergencyContact = { ...patient.emergencyContact, ...emergencyContact };
      }

      await patient.save();

      res.json({ success: true, message: 'Profile updated successfully', data: patient });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PatientController;
