const mongoose = require('mongoose');
const Joi = require('joi');
const CPSourcing = require('../models/CPSourcing');
const ChannelPartner = require('../models/ChannelPartner');
const Project = require('../models/Project');
const Lead = require('../models/Lead');
const UserReporting = require('../models/UserReporting');
const User = require('../models/User');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

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
      return cb(new Error('File is not an image. Allowed types: jpeg, png, webp'), false);
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
  selfie: Joi.string().optional(),
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
  if (!['jpeg', 'png', 'webp'].includes(ext)) throw new Error('Unsupported image format');
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
});

const getCPSourcingsSchema = Joi.object({
  userId: Joi.string().hex().length(24).optional(),
  projectId: Joi.string().hex().length(24).optional(),
  channelPartnerId: Joi.string().hex().length(24).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
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

    const project = await Project.findById(req.body.projectId).lean();
    if (!project) return res.status(400).json({ message: 'Invalid project ID' });

    let selfiePath = '';
    if (req.file) {
      selfiePath = req.file.path;
    } else if (req.body.selfie && req.body.selfie.startsWith('data:image/')) {
      selfiePath = saveBase64Image(req.body.selfie, 'uploads/cpsourcing');
    }

    let channelPartner = await ChannelPartner.findOne({ phone: req.body.channelPartnerData.phone }).lean();
    if (!channelPartner) {
      channelPartner = new ChannelPartner({
        ...req.body.channelPartnerData,
        createdBy: req.user._id,
        updatedBy: req.user._id
      });
      await channelPartner.save();
      channelPartner = channelPartner.toObject();
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
      cpSourcing.updatedBy = req.user._id;
      await cpSourcing.save();
    } else {
      cpSourcing = new CPSourcing({
        userId: req.user._id,
        channelPartnerId: channelPartner._id,
        projectId: req.body.projectId,
        sourcingHistory: [historyEntry],
        customData: req.body.customData || {},
        isActive: false,
        createdBy: req.user._id,
        updatedBy: req.user._id
      });
      await cpSourcing.save();
    }

    res.status(201).json(cpSourcing);
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('createCPSourcing - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const getCPSourcings = async (req, res) => {
  const { error, value } = getCPSourcingsSchema.validate(req.query);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const { userId, projectId, channelPartnerId, page, limit } = value;
    let query = {};

    if (req.user.role !== 'superadmin' && req.user.level !== 1) {
      const userReportings = await UserReporting.find({
        'reportsTo.path': { $regex: `/(${req.user._id})/` },
        'reportsTo.teamType': 'project'
      }).lean();

      const projectFilteredUsers = [];
      for (const ur of userReportings) {
        for (const report of ur.reportsTo) {
          if (report.teamType === 'project') {
            if (projectId) {
              if (report.project && report.project.toString() === projectId) {
                projectFilteredUsers.push({ userId: ur.user, projectId: report.project });
              }
            } else {
              projectFilteredUsers.push({ 
                userId: ur.user, 
                projectId: report.project ? report.project : null 
              });
            }
          }
        }
      }
      projectFilteredUsers.push({ userId: req.user._id, projectId: projectId || null });

      if (projectFilteredUsers.length === 0) {
        console.log('getCPSourcings - No subordinates found, filtering to self:', { userId: req.user._id });
        query.userId = req.user._id;
      } else {
        query.$or = projectFilteredUsers.map(pf => ({
          userId: pf.userId,
          ...(pf.projectId && { projectId: pf.projectId })
        }));
      }

      console.log('getCPSourcings - Filtered query:', JSON.stringify(query));
    } else {
      console.log('getCPSourcings - Superadmin or level 1 access, no user filter');
    }

    if (userId) query.userId = userId;
    if (projectId) query.projectId = projectId;
    if (channelPartnerId) query.channelPartnerId = channelPartnerId;

    const totalItems = await CPSourcing.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);
    const cpSourcings = await CPSourcing.find(query)
      .select('userId channelPartnerId projectId sourcingHistory customData createdAt isActive')
      .populate('userId', 'name email')
      .populate('channelPartnerId', 'name phone')
      .populate('projectId', 'name location')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    console.log('getCPSourcings - Found records:', cpSourcings.length);

    res.json({
      cpSourcings,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        limit
      }
    });
  } catch (err) {
    console.error('getCPSourcings - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const getCPSourcingById = async (req, res) => {
  try {
    const cpSourcing = await CPSourcing.findById(req.params.id)
      .select('userId channelPartnerId projectId sourcingHistory customData createdAt isActive')
      .populate('userId', 'name email')
      .populate('channelPartnerId', 'name phone')
      .populate('projectId', 'name location')
      .lean();
    if (!cpSourcing) return res.status(404).json({ message: 'CP Sourcing not found' });

    res.json(cpSourcing);
  } catch (err) {
    console.error('getCPSourcingById - Error:', err.message);
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

    const cpSourcings = await CPSourcing.find(query).distinct('userId').lean();
    if (!cpSourcings.length) {
      console.log('getUniqueSourcingPersons - No sourcing persons found for query:', query);
      return res.json([]);
    }

    const users = await User.find({ _id: { $in: cpSourcings } })
      .select('name email _id')
      .lean();
    console.log('getUniqueSourcingPersons - Found users:', users.map(u => ({ id: u._id, name: u.name })));
    res.json(users);
  } catch (err) {
    console.error('getUniqueSourcingPersons - Error:', err.message);
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
    }).lean();

    if (!cpSourcing) {
      return res.status(400).json({ message: 'No matching CPSourcing found for selected user, channel partner, and project' });
    }

    res.json({ cpSourcingId: cpSourcing._id });
  } catch (err) {
    console.error('validateCPSourcing - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const updateCPSourcing = async (req, res) => {
  const { error } = updateCPSourcingSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const cpSourcing = await CPSourcing.findById(req.params.id);
    if (!cpSourcing) return res.status(404).json({ message: 'CP Sourcing not found' });

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
    cpSourcing.updatedBy = req.user._id;
    await cpSourcing.save();

    res.json(cpSourcing);
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('updateCPSourcing - Error:', err.message);
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

    const associatedLeads = await Lead.findOne({ cpSourcingId: id }).lean();
    if (associatedLeads) {
      return res.status(400).json({ message: 'Cannot delete CP Sourcing with associated leads' });
    }

    for (const history of cpSourcing.sourcingHistory) {
      if (history.selfie && fs.existsSync(history.selfie)) {
        fs.unlinkSync(history.selfie);
      }
    }

    await CPSourcing.findByIdAndDelete(id);
    res.json({ message: 'CP Sourcing deleted successfully' });
  } catch (err) {
    console.error('deleteCPSourcing - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const bulkCreateCPSourcings = async (req, res) => {
  const { error } = bulkCreateCPSourcingSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const cpSourcings = [];
    for (const item of req.body) {
      const project = await Project.findById(item.projectId).lean();
      if (!project) throw new Error(`Invalid project ID: ${item.projectId}`);

      let channelPartner = await ChannelPartner.findOne({ phone: item.channelPartnerData.phone }).lean();
      if (!channelPartner) {
        channelPartner = new ChannelPartner({
          ...item.channelPartnerData,
          createdBy: req.user._id,
          updatedBy: req.user._id
        });
        await channelPartner.save();
        channelPartner = channelPartner.toObject();
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
        isActive: false,
        createdBy: req.user._id,
        updatedBy: req.user._id
      });
    }

    const result = await CPSourcing.insertMany(cpSourcings);
    res.status(201).json({ message: 'Bulk create successful', count: result.length });
  } catch (err) {
    console.error('bulkCreateCPSourcings - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const bulkUpdateCPSourcings = async (req, res) => {
  const { error } = bulkUpdateCPSourcingSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const update = {
      $set: {
        ...req.body.update,
        updatedBy: req.user._id
      }
    };
    const result = await CPSourcing.updateMany(req.body.query, update);
    res.json({ message: 'Bulk update successful', modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('bulkUpdateCPSourcings - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const bulkDeleteCPSourcings = async (req, res) => {
  const { error } = bulkDeleteCPSourcingSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const cpSourcings = await CPSourcing.find(req.body.query).lean();
    for (const sourcing of cpSourcings) {
      const leadCount = await Lead.countDocuments({ cpSourcingId: sourcing._id });
      if (leadCount > 0) return res.status(403).json({ message: `Cannot delete sourcing ${sourcing._id} used in leads` });
      for (const history of sourcing.sourcingHistory) {
        if (history.selfie && fs.existsSync(history.selfie)) {
          fs.unlinkSync(history.selfie);
        }
      }
    }

    const result = await CPSourcing.deleteMany(req.body.query);
    res.json({ message: 'Bulk delete successful', deletedCount: result.deletedCount });
  } catch (err) {
    console.error('bulkDeleteCPSourcings - Error:', err.message);
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