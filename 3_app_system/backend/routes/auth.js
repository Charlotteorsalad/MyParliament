const express = require('express');
const router = express.Router();

const { registerUser, loginUser, forgotPassword, resetPassword, completeProfile, checkUserExists, migrateUsers } = require('../controllers/authController');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/complete-profile', completeProfile);
router.post('/check-user', checkUserExists);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/migrate-users', migrateUsers);

module.exports = router;
