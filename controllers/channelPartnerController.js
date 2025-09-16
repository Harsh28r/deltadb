const ChannelPartner = require('../models/ChannelPartner');
const Lead = require('../models/Lead');
const CPSourcing = require('../models/CPSourcing');
const Joi = require('joi');
const multer = require('multer');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/channelpartners';
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
    if (!file.mimetype.startsWith('image/')) return cb(new Error('File is not an image'), false);
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

const createChannelPartnerSchema = Joi.object({
  name: Joi.string().required().min(3).max(100).trim(),
  phone: Joi.string().required().length(10).pattern(/^\d{10}$/),
  firmName: Joi.string().required().min(3).max(100).trim(),
  location: Joi.string().required().trim(),
  address: Joi.string().required().trim(),
  mahareraNo: Joi.string(). trim().optional(),
  pinCode: Joi.string().required().length(6).pattern(/^\d{6}$/),
  customData: Joi.object().optional()
});

const updateChannelPartnerSchema = Joi.object({
  name: Joi.string().min(3).max(100).trim().optional(),
  phone: Joi.string().length(10).pattern(/^\d{10}$/).optional(),
  firmName: Joi.string().min(3).max(100).trim().optional(),
  location: Joi.string().trim().optional(),
  address: Joi.string().trim().optional(),
  mahareraNo: Joi.string().trim().optional(),
  pinCode: Joi.string().length(6).pattern(/^\d{6}$/).optional(),
  customData: Joi.object().optional()
  // Removed isActive to manage via model hooks
});

const bulkCreateChannelPartnerSchema = Joi.array().items(createChannelPartnerSchema).min(1);
const bulkUpdateChannelPartnerSchema = Joi.object({
  query: Joi.object().required(),
  update: updateChannelPartnerSchema.required()
});
const bulkDeleteChannelPartnerSchema = Joi.object({
  query: Joi.object().required()
});

const createChannelPartner = async (req, res) => {
  const { error } = createChannelPartnerSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    console.log('createChannelPartner - req.body:', JSON.stringify(req.body));
    const channelPartner = new ChannelPartner({
      ...req.body,
      photo: req.file ? req.file.path : '',
      createdBy: req.user._id,
      updatedBy: req.user._id
    });
    await channelPartner.save();
    res.status(201).json(channelPartner);
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: err.message });
  }
};

const getChannelPartners = async (req, res) => {
  try {
    const query = { createdBy: req.user._id,};
    const channelPartners = await ChannelPartner.find(query)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ name: 1 });
    res.json(channelPartners);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getChannelPartnerById = async (req, res) => {
  try {
    const channelPartner = await ChannelPartner.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    if (!channelPartner) return res.status(404).json({ message: 'Channel Partner not found' });
    if (!channelPartner.createdBy.equals(req.user._id)) {
      return res.status(403).json({ message: 'Unauthorized to view this channel partner' });
    }

    // Fetch associated leads
    const leads = await Lead.find({ channelPartner: req.params.id })
      .populate('cpSourcingId', 'projectId customData')
      .populate('user', 'name email')
      .sort({ createdAt: -1 });

    // Combine channel partner and leads in response
    res.json({
      channelPartner,
      leads
    });
  } catch (err) {
    console.error('Error in getChannelPartnerById:', err);
    res.status(500).json({ message: err.message });
  }
};

const updateChannelPartner = async (req, res) => {
  const { error } = updateChannelPartnerSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const channelPartner = await ChannelPartner.findById(req.params.id);
    if (!channelPartner) return res.status(404).json({ message: 'Channel Partner not found' });
    if (!channelPartner.createdBy.equals(req.user._id)) {
      return res.status(403).json({ message: 'Unauthorized to update this channel partner' });
    }

    Object.assign(channelPartner, req.body);
    if (req.file) channelPartner.photo = req.file.path;
    channelPartner.updatedBy = req.user._id;
    await channelPartner.save();
    res.json(channelPartner);
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    res.status(500).json({ message: err.message });
  }
};

const deleteChannelPartner = async (req, res) => {
  try {
    const channelPartner = await ChannelPartner.findById(req.params.id);
    if (!channelPartner) return res.status(404).json({ message: 'Channel Partner not found' });

    const leadCount = await Lead.countDocuments({ channelPartner: req.params.id });
    if (leadCount > 0) return res.status(403).json({ message: 'Cannot delete channel partner used in leads' });

    const sourcingCount = await CPSourcing.countDocuments({ channelPartnerId: req.params.id });
    if (sourcingCount > 0) return res.status(403).json({ message: 'Cannot delete channel partner used in sourcing' });

    if (channelPartner.photo && fs.existsSync(channelPartner.photo)) {
      fs.unlinkSync(channelPartner.photo);
    }

    await channelPartner.deleteOne();
    res.json({ message: 'Channel Partner deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bulkCreateChannelPartners = async (req, res) => {
  const { error } = bulkCreateChannelPartnerSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const channelPartners = await ChannelPartner.insertMany(
      req.body.map(partner => ({
        ...partner,
        createdBy: req.user._id,
        updatedBy: req.user._id
      }))
    );
    res.status(201).json({ message: 'Bulk create successful', count: channelPartners.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bulkUpdateChannelPartners = async (req, res) => {
  const { error } = bulkUpdateChannelPartnerSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const result = await ChannelPartner.updateMany(req.body.query, {
      $set: { ...req.body.update, updatedBy: req.user._id }
    });
    res.json({ message: 'Bulk update successful', modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bulkDeleteChannelPartners = async (req, res) => {
  const { error } = bulkDeleteChannelPartnerSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const channelPartners = await ChannelPartner.find(req.body.query);
    for (const cp of channelPartners) {
      const leadCount = await Lead.countDocuments({ channelPartner: cp._id });
      if (leadCount > 0) return res.status(403).json({ message: `Cannot delete channel partner ${cp._id} used in leads` });
      const sourcingCount = await CPSourcing.countDocuments({ channelPartnerId: cp._id });
      if (sourcingCount > 0) return res.status(403).json({ message: `Cannot delete channel partner ${cp._id} used in sourcing` });
      if (cp.photo && fs.existsSync(cp.photo)) {
        fs.unlinkSync(cp.photo);
      }
    }
    const result = await ChannelPartner.deleteMany(req.body.query);
    res.json({ message: 'Bulk delete successful', deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createChannelPartner: [upload.single('photo'), createChannelPartner],
  getChannelPartners,
  getChannelPartnerById,
  updateChannelPartner: [upload.single('photo'), updateChannelPartner],
  deleteChannelPartner,
  bulkCreateChannelPartners,
  bulkUpdateChannelPartners,
  bulkDeleteChannelPartners
};