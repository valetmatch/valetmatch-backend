const express = require('express');
const router = express.Router();

// Reviews routes - to be implemented in Phase 2
router.get('/', (req, res) => {
  res.json({ message: 'Reviews coming in Phase 2' });
});

module.exports = router;
