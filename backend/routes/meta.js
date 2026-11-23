const express = require("express");
const { CRIME_TYPES, FADE_DAYS, MIN_OPACITY } = require("../config");

const router = express.Router();

// Public: the map and forms use this to know crime types, colours and fading rules.
router.get("/", (req, res) => {
  res.json({ crimeTypes: CRIME_TYPES, fadeDays: FADE_DAYS, minOpacity: MIN_OPACITY });
});

module.exports = router;
