const jwt = require('jsonwebtoken');
const { User, Patient } = require('../models');
const env = require('../config/env');
const AuditService = require('../services/AuditService');
const twilio = require('twilio');

const twilioClient = (env.TWILIO.ACCOUNT_SID && env.TWILIO.AUTH_TOKEN) 
  ? twilio(env.TWILIO.ACCOUNT_SID, env.TWILIO.AUTH_TOKEN) 
  : null;

// Normalize to E.164 (Assuming Indian numbers for this project)
const normalizePhone = (phone) => {
  if (!phone) return phone;
  let p = phone.trim();
  if (p.startsWith('+')) return p;
  if (p.startsWith('0')) p = p.substring(1);
  if (p.length === 10) return '+91' + p; // Default to India
  return '+' + p; 
};

class PatientAuthController {
  /**
   * Register a new patient
   * POST /api/auth/patient/register
   */
  static async register(req, res, next) {
    try {
      const { name, phone, email, password } = req.body;
      if (!name || !phone) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Name and phone are required.' } });
      }

      const normalizedPhone = normalizePhone(phone);
      let existing = await User.findOne({ phone: normalizedPhone });

      if (existing) {
        if (existing.isPhoneVerified) {
          return res.status(409).json({ success: false, error: { code: 'USER_EXISTS', message: 'A user with this phone number already exists.' } });
        }
        // If not verified, we can update the details
        existing.name = name;
        if (email) existing.email = email;
        await existing.save();
      } else {
        existing = new User({
          name,
          phone: normalizedPhone,
          email: email || null,
          role: 'PATIENT',
          isPhoneVerified: false,
          isActive: false
        });
        await existing.save();

        await Patient.create({
          userId: existing._id,
          name: existing.name,
          phone: existing.phone
        });
      }

      // Send OTP via Twilio Verify
      if (twilioClient && env.TWILIO.VERIFY_SERVICE_SID) {
        try {
          await twilioClient.verify.v2.services(env.TWILIO.VERIFY_SERVICE_SID)
            .verifications
            .create({ to: normalizedPhone, channel: 'sms' });
        } catch (twilioErr) {
          console.error("Twilio Verify Error:", twilioErr);
          return res.status(500).json({ success: false, error: { code: 'TWILIO_ERROR', message: 'Failed to send OTP. Please check the phone number.' } });
        }
      } else {
        console.warn("[WARN] Twilio is not configured. Simulating OTP send for", normalizedPhone);
      }

      res.status(201).json({
        success: true,
        message: 'Registration initiated. OTP sent for verification.',
        userId: existing._id
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send OTP for Login
   * POST /api/auth/patient/send-otp
   */
  static async sendOtp(req, res, next) {
    try {
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Phone number is required.' } });
      }

      const normalizedPhone = normalizePhone(phone);
      
      let user = await User.findOne({ phone: normalizedPhone });
      if (!user) {
        // Auto-create basic patient user to support passwordless flow
        user = await User.create({
          phone: normalizedPhone,
          name: 'Patient ' + normalizedPhone.slice(-4),
          role: 'PATIENT',
          isPhoneVerified: false,
          isActive: false
        });
        await Patient.create({
          userId: user._id,
          name: user.name,
          phone: user.phone
        });
      }

      // Send OTP via Twilio Verify
      if (twilioClient && env.TWILIO.VERIFY_SERVICE_SID) {
        try {
          await twilioClient.verify.v2.services(env.TWILIO.VERIFY_SERVICE_SID)
            .verifications
            .create({ to: normalizedPhone, channel: 'sms' });
        } catch (twilioErr) {
          console.error("Twilio Verify Error:", twilioErr);
          return res.status(500).json({ success: false, error: { code: 'TWILIO_ERROR', message: 'Failed to send OTP.' } });
        }
      } else {
        console.warn("[WARN] Twilio is not configured. Simulating OTP send for login:", normalizedPhone);
      }

      res.json({
        success: true,
        message: 'OTP sent to registered phone.'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify OTP
   * POST /api/auth/patient/verify-otp
   */
  static async verifyOtp(req, res, next) {
    try {
      const { phone, otp } = req.body;
      if (!phone || !otp) {
        return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Phone and OTP are required.' } });
      }

      const normalizedPhone = normalizePhone(phone);
      const user = await User.findOne({ phone: normalizedPhone });
      if (!user) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found.' } });
      }

      let isVerified = false;

      // Verify OTP via Twilio Verify
      if (twilioClient && env.TWILIO.VERIFY_SERVICE_SID) {
        try {
          const verificationCheck = await twilioClient.verify.v2.services(env.TWILIO.VERIFY_SERVICE_SID)
            .verificationChecks
            .create({ to: normalizedPhone, code: otp });

          if (verificationCheck.status === 'approved') {
            isVerified = true;
          } else {
            return res.status(400).json({ success: false, error: { code: 'INVALID_OTP', message: 'Incorrect OTP. Please try again.' } });
          }
        } catch (twilioErr) {
          console.error("Twilio Verify Check Error:", twilioErr);
          return res.status(400).json({ success: false, error: { code: 'INVALID_OTP', message: 'Failed to verify OTP or OTP expired.' } });
        }
      } else {
        // Fallback for dev mode when Twilio isn't set up
        if (process.env.NODE_ENV === 'development' && otp === '123456') {
          isVerified = true;
        } else {
          return res.status(400).json({ success: false, error: { code: 'INVALID_OTP', message: 'Incorrect OTP.' } });
        }
      }

      if (isVerified) {
        user.isPhoneVerified = true;
        user.isActive = true; // Activate user
        await user.save();

        const token = jwt.sign(
          { id: user._id, role: user.role, phone: user.phone },
          env.JWT_SECRET,
          { expiresIn: env.JWT_EXPIRES_IN }
        );

        const patient = await Patient.findOne({ userId: user._id });

        await AuditService.log({
          actorId: user._id,
          actorRole: user.role,
          action: 'PATIENT_LOGIN_OTP',
          entity: 'USER',
          entityId: String(user._id)
        });

        res.json({
          success: true,
          message: 'Phone verified successfully.',
          token,
          user: {
            id: user._id,
            name: user.name,
            phone: user.phone,
            role: user.role,
            patientId: patient?._id || null
          }
        });
      }
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PatientAuthController;
