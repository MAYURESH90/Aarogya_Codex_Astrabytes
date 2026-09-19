const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Patient } = require('../models');
const env = require('../config/env');
const AuditService = require('../services/AuditService');
const NotificationService = require('../services/NotificationService');
const { NOTIFICATION_TYPES } = require('../config/constants');

class AuthController {
  /**
   * Register a new user (Patient, Staff, Doctor)
   */
  static async register(req, res, next) {
    try {
      const { name, phone, password, role = 'PATIENT', hospitalId, opdId, doctorId } = req.body;

      if (!name || !phone) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Name and phone are required.' }
        });
      }

      const existing = await User.findOne({ phone });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: { code: 'USER_EXISTS', message: 'A user with this phone number already exists.' }
        });
      }

      const passwordHash = password ? await bcrypt.hash(password, 10) : null;

      const user = new User({
        name,
        phone,
        passwordHash,
        role,
        hospitalId: hospitalId || null,
        opdId: opdId || null,
        doctorId: doctorId || null,
        isPhoneVerified: false
      });

      await user.save();

      // Create linked Patient profile if role is PATIENT
      if (role === 'PATIENT') {
        await Patient.create({
          userId: user._id,
          name: user.name,
          phone: user.phone
        });
      }

      // Generate verification OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.otpHash = await bcrypt.hash(otp, 8);
      user.otpExpiresAt = new Date(Date.now() + 10 * 60000); // 10 mins
      user.lastOtpSentAt = new Date();
      await user.save();

      // Send OTP via SMS
      await NotificationService.sendSMS({
        recipientPhone: phone,
        message: `Your Aarogya verification OTP is ${otp}. Valid for 10 minutes.`,
        type: NOTIFICATION_TYPES.OTP,
        force: true
      });

      await AuditService.log({
        actorId: user._id,
        actorRole: user.role,
        action: 'USER_REGISTERED',
        entity: 'USER',
        entityId: String(user._id)
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully. OTP sent for phone verification.',
        userId: user._id,
        role: user.role,
        devOtp: process.env.NODE_ENV === 'development' ? otp : undefined
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Request OTP for login / verification
   */
  static async requestOtp(req, res, next) {
    try {
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({
          success: false,
          error: { code: 'PHONE_REQUIRED', message: 'Phone number is required.' }
        });
      }

      let user = await User.findOne({ phone });
      if (!user) {
        // Auto-create basic patient user
        user = await User.create({
          phone,
          name: 'Patient ' + phone.slice(-4),
          role: 'PATIENT',
          isPhoneVerified: false
        });
        await Patient.create({
          userId: user._id,
          name: user.name,
          phone: user.phone
        });
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.otpHash = await bcrypt.hash(otp, 8);
      user.otpExpiresAt = new Date(Date.now() + 10 * 60000);
      user.otpAttempts = 0;
      user.lastOtpSentAt = new Date();
      await user.save();

      await NotificationService.sendSMS({
        recipientPhone: phone,
        message: `Your Aarogya OTP is ${otp}. Valid for 10 minutes.`,
        type: NOTIFICATION_TYPES.OTP,
        force: true
      });

      res.json({
        success: true,
        message: 'OTP sent to registered phone.',
        devOtp: process.env.NODE_ENV === 'development' ? otp : undefined
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify OTP and Login
   */
  static async verifyOtp(req, res, next) {
    try {
      const { phone, otp } = req.body;
      if (!phone || !otp) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Phone and OTP are required.' }
        });
      }

      const user = await User.findOne({ phone });
      if (!user || !user.otpHash || !user.otpExpiresAt) {
        return res.status(400).json({
          success: false,
          error: { code: 'OTP_NOT_REQUESTED', message: 'Please request a new OTP first.' }
        });
      }

      if (new Date() > user.otpExpiresAt) {
        return res.status(400).json({
          success: false,
          error: { code: 'OTP_EXPIRED', message: 'OTP has expired. Please request a new one.' }
        });
      }

      if (user.otpAttempts >= 5) {
        return res.status(429).json({
          success: false,
          error: { code: 'TOO_MANY_ATTEMPTS', message: 'Maximum OTP attempts exceeded. Request a new OTP.' }
        });
      }

      const isMatch = await bcrypt.compare(otp, user.otpHash);
      if (!isMatch) {
        user.otpAttempts += 1;
        await user.save();
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_OTP', message: 'Incorrect OTP. Please try again.' }
        });
      }

      // Successful verification
      user.isPhoneVerified = true;
      user.otpHash = null;
      user.otpExpiresAt = null;
      user.otpAttempts = 0;
      await user.save();

      const token = jwt.sign(
        { id: user._id, role: user.role, phone: user.phone },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN }
      );

      // Find linked patient profile if applicable
      const patient = await Patient.findOne({ userId: user._id });

      await AuditService.log({
        actorId: user._id,
        actorRole: user.role,
        action: 'USER_LOGIN_OTP',
        entity: 'USER',
        entityId: String(user._id)
      });

      res.json({
        success: true,
        message: 'Phone verified and logged in successfully.',
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          patientId: patient?._id || null,
          hospitalId: user.hospitalId,
          opdId: user.opdId,
          doctorId: user.doctorId
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Password Login for Staff, Doctor and Admin
   */
  static async loginWithPassword(req, res, next) {
    try {
      const { phone, password } = req.body;
      if (!phone || !password) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Phone and password are required.' }
        });
      }

      const user = await User.findOne({ phone });
      if (!user || !user.passwordHash) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid phone or password.' }
        });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid phone or password.' }
        });
      }

      const token = jwt.sign(
        { id: user._id, role: user.role, phone: user.phone },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN }
      );

      const patient = await Patient.findOne({ userId: user._id });

      await AuditService.log({
        actorId: user._id,
        actorRole: user.role,
        action: 'USER_LOGIN_PASSWORD',
        entity: 'USER',
        entityId: String(user._id)
      });

      res.json({
        success: true,
        message: 'Logged in successfully.',
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          patientId: patient?._id || null,
          hospitalId: user.hospitalId,
          opdId: user.opdId,
          doctorId: user.doctorId
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
