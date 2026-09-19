const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const tokenRoutes = require('./tokenRoutes');
const queueRoutes = require('./queueRoutes');
const hospitalRoutes = require('./hospitalRoutes');
const medicalRoutes = require('./medicalRoutes');
const paymentRoutes = require('./paymentRoutes');
const displayRoutes = require('./displayRoutes');
const ivrRoutes = require('./ivrRoutes');
const adminRoutes = require('./adminRoutes');

router.use('/auth', authRoutes);
router.use('/tokens', tokenRoutes);
router.use('/queue', queueRoutes);
router.use('/', hospitalRoutes);
router.use('/medical', medicalRoutes);
router.use('/payments', paymentRoutes);
router.use('/display', displayRoutes);
router.use('/ivr', ivrRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
