const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/PaymentController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/orders', authMiddleware, PaymentController.createOrder);
router.post('/verify', authMiddleware, PaymentController.verifyPayment);

module.exports = router;
