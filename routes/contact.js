const express = require('express');
const { handleContactForm } = require('../controller/contactController');

const router = express.Router();

router.post('/', handleContactForm);

module.exports = router;