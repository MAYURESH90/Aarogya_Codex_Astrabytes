const { Hospital, OPD, Doctor, Specialist, DoctorSchedule, OPDSession } = require('../models');

class HospitalController {
  static async getHospitals(req, res, next) {
    try {
      const query = { isActive: true };
      if (req.query.pinCode) {
        query.pinCode = req.query.pinCode;
      }
      if (req.query.isGovernment) {
        query.isGovernment = req.query.isGovernment === 'true';
      }
      const hospitals = await Hospital.find(query);
      res.json({ success: true, data: hospitals });
    } catch (error) {
      next(error);
    }
  }

  static async getOPDs(req, res, next) {
    try {
      const query = { isActive: true };
      if (req.query.hospitalId) query.hospitalId = req.query.hospitalId;
      const opds = await OPD.find(query).populate('hospitalId');
      res.json({ success: true, data: opds });
    } catch (error) {
      next(error);
    }
  }

  static async getDoctors(req, res, next) {
    try {
      const query = { isActive: true };
      if (req.query.opdId) query.opdId = req.query.opdId;
      if (req.query.hospitalId) query.hospitalId = req.query.hospitalId;
      const doctors = await Doctor.find(query).populate('opdId hospitalId');
      res.json({ success: true, data: doctors });
    } catch (error) {
      next(error);
    }
  }

  static async getSpecialists(req, res, next) {
    try {
      const specialists = await Specialist.find().populate({
        path: 'doctorId',
        populate: ['opdId', 'hospitalId']
      });
      res.json({ success: true, data: specialists });
    } catch (error) {
      next(error);
    }
  }

  static async getSessions(req, res, next) {
    try {
      const query = {};
      if (req.query.opdId) query.opdId = req.query.opdId;
      if (req.query.doctorId) query.doctorId = req.query.doctorId;
      if (req.query.date) query.date = req.query.date;

      const sessions = await OPDSession.find(query)
        .populate('opdId doctorId hospitalId');
      res.json({ success: true, data: sessions });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Check Specialist Availability with intelligent fallbacks (Section 7)
   */
  static async checkSpecialistAvailability(req, res, next) {
    try {
      const { specialistId, doctorId, date } = req.query;
      const targetDate = date || new Date().toISOString().split('T')[0];

      let specialist = null;
      if (specialistId) {
        specialist = await Specialist.findById(specialistId).populate('doctorId');
      } else if (doctorId) {
        specialist = await Specialist.findOne({ doctorId }).populate('doctorId');
      }

      if (!specialist) {
        return res.status(404).json({
          success: false,
          error: { code: 'SPECIALIST_NOT_FOUND', message: 'Specialist not found.' }
        });
      }

      const dayName = new Date(targetDate).toLocaleDateString('en-US', { weekday: 'long' });
      const doctor = specialist.doctorId;

      // 1. Check if doctor is marked unavailable in Doctor model
      const isDoctorAvailable = doctor.status !== 'UNAVAILABLE' && doctor.status !== 'COMPLETED_FOR_DAY';

      // 2. Check scheduled day
      const isDaySupported = specialist.availableDays.includes(dayName);

      // 3. Check specific DoctorSchedule and leaves
      const schedule = await DoctorSchedule.findOne({ doctorId: doctor._id, dayOfWeek: dayName });
      const isOnLeave = schedule ? schedule.leaves.some(l => l.date === targetDate) : false;

      // 4. Check if an active session exists
      const session = await OPDSession.findOne({
        doctorId: doctor._id,
        date: targetDate,
        status: { $in: ['ACTIVE', 'SCHEDULED'] }
      });

      const isAvailable = isDoctorAvailable && isDaySupported && !isOnLeave && !!session;

      if (isAvailable) {
        return res.json({
          success: true,
          data: {
            available: true,
            specialist: {
              id: specialist._id,
              name: doctor.name,
              specialty: specialist.specialtyName
            },
            date: targetDate,
            session: {
              id: session._id,
              name: session.name,
              startTime: session.startTime,
              endTime: session.endTime
            }
          }
        });
      }

      // Specialist unavailable -> Build intelligent alternatives (Section 7)
      const alternatives = [];

      // Find next available day
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      for (let i = 1; i <= 7; i++) {
        const nextD = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
        const nextDayName = nextD.toLocaleDateString('en-US', { weekday: 'long' });
        if (specialist.availableDays.includes(nextDayName)) {
          const nextDateStr = nextD.toISOString().split('T')[0];
          alternatives.push({
            type: 'ALTERNATE_DAY',
            date: nextDateStr,
            day: nextDayName,
            message: `Specialist is available on ${nextDayName} (${nextDateStr})`
          });
          break;
        }
      }

      // Find General OPD fallback in same hospital
      const generalOpd = await OPD.findOne({
        hospitalId: doctor.hospitalId,
        isGeneralOPD: true
      });

      if (generalOpd) {
        alternatives.push({
          type: 'GENERAL_OPD',
          opdId: generalOpd._id,
          opdName: generalOpd.name,
          roomNumber: generalOpd.roomNumber,
          message: `Consult at ${generalOpd.name} (Room ${generalOpd.roomNumber}) today.`
        });
      }

      res.json({
        success: true,
        data: {
          available: false,
          reason: isOnLeave ? 'Doctor is on leave on this date' : 'No active OPD session scheduled for this day',
          alternatives
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = HospitalController;
