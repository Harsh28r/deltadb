const express = require('express');
const router = express.Router();
const { createCpSource, getAllCpSources, listCpSources, updateCpSource, deleteCpSource } = require('../controllers/cpSourceController');

// Get all CP Sources
router.get('/',   getAllCpSources);

// Create CP Source under a project
router.post('/',   createCpSource);

// List CP Sources by project
router.get('/:projectId',   listCpSources);

// Update CP Source by id
router.put('/:id',   updateCpSource);

// Delete CP Source by id
router.delete('/:id',   deleteCpSource);

module.exports = router;


