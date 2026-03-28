const express = require('express');
const router = express.Router();
const { getAllEdu, getEduById, incrementView } = require('../controllers/eduController');

router.get('/', getAllEdu);
router.patch('/:id/view', incrementView);
router.get('/:id', getEduById);

module.exports = router;
