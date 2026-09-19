const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/AdminController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get('/config', authMiddleware, roleMiddleware('ADMIN'), AdminController.getConfiguration);
router.put('/config', authMiddleware, roleMiddleware('ADMIN'), AdminController.updateConfiguration);
router.get('/audit', authMiddleware, roleMiddleware('ADMIN'), AdminController.getAuditLogs);

module.exports = router;
