const express = require('express');
const router = express.Router();
const HospitalController = require('../controllers/HospitalController');

router.get('/hospitals', HospitalController.getHospitals);
router.get('/opds', HospitalController.getOPDs);
router.get('/doctors', HospitalController.getDoctors);
router.get('/specialists', HospitalController.getSpecialists);
router.get('/specialists/availability', HospitalController.checkSpecialistAvailability);
router.get('/sessions', HospitalController.getSessions);

module.exports = router;
