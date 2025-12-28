const express = require('express');
const router = express.Router();
const { getAllEdu, getEduById } = require('../controllers/eduController');
const { EduResource } = require('../models/EduResource');

router.get('/', getAllEdu);
router.get('/:id', getEduById);


module.exports = router;
