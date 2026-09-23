const express = require('express');
const router = express.Router();
const { Notification } = require('../models');

/**
 * GET /api/notifications
 * Query sent SMS notifications by recipientPhone or tokenId
 */
router.get('/', async (req, res, next) => {
  try {
    const { phone, tokenId, limit = 20 } = req.query;
    const query = {};

    if (phone) {
      const cleanPhone = String(phone).replace(/[^0-9]/g, '');
      // Match phone string or digits
      query.recipientPhone = { $regex: cleanPhone, $options: 'i' };
    }
    if (tokenId) {
      query.tokenId = tokenId;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1, sentAt: -1 })
      .limit(Number(limit));

    res.json({
      success: true,
      count: notifications.length,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
