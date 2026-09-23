const express = require('express');
const router = express.Router();
const TokenController = require('../controllers/TokenController');
const { optionalAuth } = require('../middleware/authMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

// Public patient live status lookup
router.get('/:tokenId/status', TokenController.getTokenStatus);
router.get('/:tokenId/eta', TokenController.getTokenETA);
router.get('/:tokenId', TokenController.getTokenById);

// Online token registration (Allows guest or authenticated patient with custom phone number)
router.post('/online', optionalAuth, TokenController.registerOnlineToken);

// Paper token registration (Staff / Admin role) - Mandatory immediate ETA response!
router.post('/paper', authMiddleware, roleMiddleware('STAFF', 'ADMIN'), TokenController.registerPaperToken);

module.exports = router;
