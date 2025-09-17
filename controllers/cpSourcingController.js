const mongoose = require('mongoose');
const CPSourcing = require('../models/CPSourcing');
const ChannelPartner = require('../models/ChannelPartner');
const Project = require('../models/Project');
const Lead = require('../models/Lead');
const Joi = require('joi');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const mime = require('mime-types');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/cpsourcing';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    console.log('Uploaded file MIME type:', file.mimetype);
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      console.log('File rejected - Not an image:', file.originalname);
      return cb(new Error('File is not an image. Allowed types: jpeg, png, gif, webp'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

const createCPSourcingSchema = Joi.object({
  channelPartnerData: Joi.object({
    name: Joi.string().required().min(3).max(100).trim(),
    phone: Joi.string().required().length(10).pattern(/^\d{10}$/),
    firmName: Joi.string().required().min(3).max(100).trim(),
    location: Joi.string().required().trim(),
    address: Joi.string().required().trim(),
    mahareraNo: Joi.string().optional().trim(),
    pinCode: Joi.string().required().length(6).pattern(/^\d{6}$/),
    customData: Joi.object().optional()
  }).required(),
  projectId: Joi.string().hex().length(24).required(),
  selfie: Joi.string().optional(), // Changed back to optional to align with model
  location: Joi.object({
    lat: Joi.number().required().min(-90).max(90),
    lng: Joi.number().required().min(-180).max(180)
  }).required(),
  notes: Joi.string().optional(),
  customData: Joi.object().optional()
});

const saveBase64Image = (base64String, dir) => {
  const matches = base64String.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
  if (!matches) throw new Error('Invalid base64 image');
  const ext = matches[1].toLowerCase();
  if (!['jpeg', 'png', 'gif', 'webp'].includes(ext)) throw new Error('Unsupported image format');
  const buffer = Buffer.from(matches[2], 'base64');
  const filename = `${Date.now()}-live-selfie.${ext}`;
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, buffer);
  return filepath;
};

const updateCPSourcingSchema = Joi.object({
  selfie: Joi.string().optional(),
  location: Joi.object({
    lat: Joi.number().required().min(-90).max(90),
    lng: Joi.number().required().min(-180).max(180)
  }).required(),
  notes: Joi.string().optional(),
  customData: Joi.object().optional()
  // Removed isActive from schema to manage via model hooks
});

const bulkCreateCPSourcingSchema = Joi.array().items(createCPSourcingSchema).min(1);
const bulkUpdateCPSourcingSchema = Joi.object({
  query: Joi.object().required(),
  update: updateCPSourcingSchema.required()
});
const bulkDeleteCPSourcingSchema = Joi.object({
  query: Joi.object().required()
});

const createCPSourcing = async (req, res) => {
  const { error } = createCPSourcingSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    console.log('createCPSourcing - req.body:', JSON.stringify(req.body));
    console.log('createCPSourcing - req.file:', req.file);

    const project = await Project.findById(req.body.projectId);
    if (!project) return res.status(400).json({ message: 'Invalid project ID' });
    if (!project.members.includes(req.user._id) && !project.managers.includes(req.user._id)) {
      return res.status(403).json({ message: 'Project not assigned to sourcing person' });
    }

    let selfiePath = '';
    if (req.file) {
      selfiePath = req.file.path;
    } else if (req.body.selfie && req.body.selfie.startsWith('data:image/')) {
      selfiePath = saveBase64Image(req.body.selfie, 'uploads/cpsourcing');
    }

    let channelPartner = await ChannelPartner.findOne({ phone: req.body.channelPartnerData.phone });
    if (!channelPartner) {
      channelPartner = new ChannelPartner({
        ...req.body.channelPartnerData,
        createdBy: req.user._id,
        updatedBy: req.user._id
      });
      await channelPartner.save();
    }

    let cpSourcing = await CPSourcing.findOne({
      userId: req.user._id,
      channelPartnerId: channelPartner._id,
      projectId: req.body.projectId
    });

    const historyEntry = {
      date: new Date(),
      selfie: selfiePath,
      location: req.body.location,
      notes: req.body.notes || ''
    };

    if (cpSourcing) {
      cpSourcing.sourcingHistory.push(historyEntry);
      cpSourcing.customData = req.body.customData || cpSourcing.customData;
      // isActive managed by model hook
      await cpSourcing.save();
    } else {
      cpSourcing = new CPSourcing({
        userId: req.user._id,
        channelPartnerId: channelPartner._id,
        projectId: req.body.projectId,
        sourcingHistory: [historyEntry],
        customData: req.body.customData || {},
        isActive: false // Default to false
      });
      await cpSourcing.save();
    }

    res.status(201).json(cpSourcing);
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: err.message });
  }
};

const getCPSourcings = async (req, res) => {
  try {
    const query = { userId: req.user._id };
    const cpSourcings = await CPSourcing.find(query)
      .populate('userId', 'name email')
      .populate('channelPartnerId', 'name phone')
      .populate('projectId', 'name location')
      .sort({ createdAt: -1 });
    res.json(cpSourcings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getCPSourcingById = async (req, res) => {
  try {
    const cpSourcing = await CPSourcing.findById(req.params.id)
      .populate('userId', 'name email')
      .populate('channelPartnerId', 'name phone')
      .populate('projectId', 'name location');
    if (!cpSourcing) return res.status(404).json({ message: 'CP Sourcing not found' });
    if (!cpSourcing.userId.equals(req.user._id)) {
      return res.status(403).json({ message: 'Unauthorized to view this sourcing' });
    }
    res.json(cpSourcing);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getUniqueSourcingPersons = async (req, res) => {
  try {
    console.log('getUniqueSourcingPersons - query:', req.query);
    const { projectId, channelPartnerId } = req.query;
    const query = {};
    if (projectId) {
      if (!mongoose.isValidObjectId(projectId)) {
        return res.status(400).json({ message: 'Invalid projectId' });
      }
      query.projectId = projectId;
    }
    if (channelPartnerId) {
      if (!mongoose.isValidObjectId(channelPartnerId)) {
        return res.status(400).json({ message: 'Invalid channelPartnerId' });
      }
      query.channelPartnerId = channelPartnerId;
    }

    const cpSourcings = await CPSourcing.find(query).distinct('userId');
    if (!cpSourcings.length) {
      console.log('No sourcing persons found for query:', query);
      return res.json([]);
    }

    const users = await User.find({ _id: { $in: cpSourcings } }).select('name email _id');
    if (!users.length) {
      console.log('No users found for userIds:', cpSourcings);
      return res.json([]);
    }

    console.log('Found users:', users.map(u => ({ id: u._id, name: u.name })));
    res.json(users);
  } catch (err) {
    console.error('Error in getUniqueSourcingPersons:', err);
    res.status(500).json({ message: err.message });
  }
};

const validateCPSourcing = async (req, res) => {
  const { userId, channelPartnerId, projectId } = req.body;

  try {
    if (!userId || !channelPartnerId || !projectId) {
      return res.status(400).json({ message: 'userId, channelPartnerId, and projectId are required' });
    }

    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(channelPartnerId) || !mongoose.isValidObjectId(projectId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    const cpSourcing = await CPSourcing.findOne({
      userId,
      channelPartnerId,
      projectId
    });

    if (!cpSourcing) {
      return res.status(400).json({ message: 'No matching CPSourcing found for selected user, channel partner, and project' });
    }

    res.json({ cpSourcingId: cpSourcing._id });
  } catch (err) {
    console.error('Error in validateCPSourcing:', err);
    res.status(500).json({ message: err.message });
  }
};

const updateCPSourcing = async (req, res) => {
  const { error } = updateCPSourcingSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const cpSourcing = await CPSourcing.findById(req.params.id);
    if (!cpSourcing) return res.status(404).json({ message: 'CP Sourcing not found' });
    if (!cpSourcing.userId.equals(req.user._id)) {
      return res.status(403).json({ message: 'Unauthorized to update this sourcing' });
    }

    let selfiePath = cpSourcing.sourcingHistory[cpSourcing.sourcingHistory.length - 1].selfie;
    if (req.file) {
      selfiePath = req.file.path;
    } else if (req.body.selfie && req.body.selfie.startsWith('data:image/')) {
      selfiePath = saveBase64Image(req.body.selfie, 'uploads/cpsourcing');
    }

    const historyEntry = {
      date: new Date(),
      selfie: selfiePath,
      location: req.body.location,
      notes: req.body.notes || ''
    };
    cpSourcing.sourcingHistory.push(historyEntry);
    cpSourcing.customData = req.body.customData || cpSourcing.customData;
    // isActive managed by model hook
    await cpSourcing.save();

    res.json(cpSourcing);
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: err.message });
  }
};

const deleteCPSourcing = async (req, res) => {
  const { id } = req.params;

  try {
    console.log('deleteCPSourcing - id:', id);
    const cpSourcing = await CPSourcing.findById(id);
    if (!cpSourcing) {
      return res.status(404).json({ message: 'CP Sourcing not found' });
    }

    // Check for associated leads
    const associatedLeads = await Lead.findOne({ cpSourcingId: id });
    if (associatedLeads) {
      return res.status(400).json({ message: 'Cannot delete CP Sourcing with associated leads' });
    }

    // Delete selfie files from sourcingHistory
    for (const history of cpSourcing.sourcingHistory) {
      if (history.selfie && fs.existsSync(history.selfie)) {
        fs.unlinkSync(history.selfie);
      }
    }

    await CPSourcing.findByIdAndDelete(id);
    res.json({ message: 'CP Sourcing deleted successfully' });
  } catch (err) {
    console.error('deleteCPSourcing - Error:', err);
    res.status(500).json({ message: err.message });
  }
};

const bulkCreateCPSourcings = async (req, res) => {
  const { error } = bulkCreateCPSourcingSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const cpSourcings = [];
    for (const item of req.body) {
      const project = await Project.findById(item.projectId);
      if (!project) throw new Error(`Invalid project ID: ${item.projectId}`);
      if (!project.members.includes(req.user._id) && !project.managers.includes(req.user._id)) {
        throw new Error(`Project ${item.projectId} not assigned to user`);
      }

      let channelPartner = await ChannelPartner.findOne({ phone: item.channelPartnerData.phone });
      if (!channelPartner) {
        channelPartner = new ChannelPartner({
          ...item.channelPartnerData,
          createdBy: req.user._id,
          updatedBy: req.user._id
        });
        await channelPartner.save();
      }

      let selfiePath = '';
      if (item.selfie && item.selfie.startsWith('data:image/')) {
        selfiePath = saveBase64Image(item.selfie, 'uploads/cpsourcing');
      }

      cpSourcings.push({
        userId: req.user._id,
        channelPartnerId: channelPartner._id,
        projectId: item.projectId,
        sourcingHistory: [{
          date: new Date(),
          selfie: selfiePath,
          location: item.location,
          notes: item.notes || ''
        }],
        customData: item.customData || {},
        isActive: false // Default to false
      });
    }

    const result = await CPSourcing.insertMany(cpSourcings);
    res.status(201).json({ message: 'Bulk create successful', count: result.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bulkUpdateCPSourcings = async (req, res) => {
  const { error } = bulkUpdateCPSourcingSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const result = await CPSourcing.updateMany(req.body.query, {
      $set: req.body.update // isActive managed by model hook
    });
    res.json({ message: 'Bulk update successful', modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bulkDeleteCPSourcings = async (req, res) => {
  const { error } = bulkDeleteCPSourcingSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const cpSourcings = await CPSourcing.find(req.body.query);
    for (const sourcing of cpSourcings) {
      const leadCount = await Lead.countDocuments({ cpSourcingId: sourcing._id });
      if (leadCount > 0) return res.status(403).json({ message: `Cannot delete sourcing ${sourcing._id} used in leads` });
      // Delete selfie files
      for (const history of sourcing.sourcingHistory) {
        if (history.selfie && fs.existsSync(history.selfie)) {
          fs.unlinkSync(history.selfie);
        }
      }
    }
    const result = await CPSourcing.deleteMany(req.body.query);
    res.json({ message: 'Bulk delete successful', deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createCPSourcing: [upload.single('selfie'), createCPSourcing],
  getCPSourcings,
  getCPSourcingById,
  getUniqueSourcingPersons,
  updateCPSourcing: [upload.single('selfie'), updateCPSourcing],
  deleteCPSourcing,
  bulkCreateCPSourcings,
  bulkUpdateCPSourcings,
  bulkDeleteCPSourcings,
  validateCPSourcing
};