const express = require('express');
const router = express.Router();
const DisplayController = require('../controllers/DisplayController');

// Public hospital display board data
router.get('/:hospitalId', DisplayController.getDisplayBoard);

module.exports = router;
