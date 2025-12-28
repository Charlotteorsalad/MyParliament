const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const { updateProfile, getMe, toggleBookmark } = require("../controllers/userController");

router.patch("/profile", auth, updateProfile);
router.get("/me", auth, getMe);
router.patch("/edubookmark",auth,toggleBookmark);

module.exports = router;
