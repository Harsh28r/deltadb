const express = require('express');
const router = express.Router();
const ChannelPartner = require('../models/ChannelPartner');
const CPSourcing = require('../models/CPSourcing');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

// Authentication middleware (adjust path as needed)
const auth = require('../middleware/auth');

// Serve ChannelPartner photo
router.get('/api/channel-partner/:id/photo', auth, async (req, res) => {
  try {
    const channelPartner = await ChannelPartner.findById(req.params.id);
    if (!channelPartner) {
      return res.status(404).json({ message: 'Channel Partner not found' });
    }
    // Authorization check for sourcing_person
    if (req.user.role === 'sourcing_person' && !channelPartner.createdBy.equals(req.user._id)) {
      return res.status(403).json({ message: 'Unauthorized to view this channel partner photo' });
    }
    if (!channelPartner.photo) {
      return res.status(404).json({ message: 'Photo not found' });
    }
    const filePath = path.resolve(channelPartner.photo);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Photo file not found' });
    }

    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    res.set('Content-Type', mimeType);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('Error serving ChannelPartner photo:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Serve CPSourcing selfie by history index
router.get('/api/cp-sourcing/:id/selfie/:historyIndex', auth, async (req, res) => {
  try {
    const cpSourcing = await CPSourcing.findById(req.params.id);
    if (!cpSourcing) {
      return res.status(404).json({ message: 'CP Sourcing not found' });
    }
    // Authorization check for sourcing_person
    if (req.user.role === 'sourcing_person' && !cpSourcing.userId.equals(req.user._id)) {
      return res.status(403).json({ message: 'Unauthorized to view this sourcing selfie' });
    }
    const historyIndex = parseInt(req.params.historyIndex, 10);
    if (isNaN(historyIndex) || !cpSourcing.sourcingHistory[historyIndex] || !cpSourcing.sourcingHistory[historyIndex].selfie) {
      return res.status(404).json({ message: 'Selfie not found' });
    }

    const selfiePath = cpSourcing.sourcingHistory[historyIndex].selfie;
    const filePath = path.resolve(selfiePath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Selfie file not found' });
    }

    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    res.set('Content-Type', mimeType);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('Error serving CPSourcing selfie:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;