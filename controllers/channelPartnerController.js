const mongoose = require('mongoose');
const ChannelPartner = require('../models/ChannelPartner');
const Lead = require('../models/Lead');
const CPSourcing = require('../models/CPSourcing');
const Joi = require('joi');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

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

const createChannelPartnerSchema = Joi.object({
  name: Joi.string().required().min(3).max(100).trim(),
  phone: Joi.string().required().length(10).pattern(/^\d{10}$/),
  firmName: Joi.string().required().min(3).max(100).trim(),
  location: Joi.string().required().trim(),
  address: Joi.string().required().trim(),
  mahareraNo: Joi.string().trim().optional(),
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
});

const getChannelPartnersSchema = Joi.object({
  name: Joi.string().trim().optional(),
  phone: Joi.string().length(10).pattern(/^\d{10}$/).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
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
    console.log('createChannelPartner - req.file:', req.file);
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
    console.error('createChannelPartner - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const getChannelPartners = async (req, res) => {
  const { error, value } = getChannelPartnersSchema.validate(req.query);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const { name, phone, page, limit } = value;
    const query = {};
    if (name) query.name = { $regex: name, $options: 'i' };
    if (phone) query.phone = phone;

    console.log('getChannelPartners - query:', JSON.stringify(query));
    const totalItems = await ChannelPartner.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);
    const channelPartners = await ChannelPartner.find(query)
      .select('name phone firmName location address mahareraNo isActive pinCode customData photo createdBy updatedBy createdAt updatedAt')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({
      channelPartners,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        limit
      }
    });
  } catch (err) {
    console.error('getChannelPartners - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const getChannelPartnerById = async (req, res) => {
  try {
    const channelPartner = await ChannelPartner.findById(req.params.id)
      .select('name phone firmName location address mahareraNo pinCode isActive customData photo createdBy updatedBy createdAt updatedAt')
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .lean();
    if (!channelPartner) return res.status(404).json({ message: 'Channel Partner not found' });

    const leads = await Lead.find({ channelPartner: req.params.id })
      .select('user project currentStatus customData createdAt')
      .populate('cpSourcingId', 'projectId customData')
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      channelPartner,
      leads
    });
  } catch (err) {
    console.error('getChannelPartnerById - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const updateChannelPartner = async (req, res) => {
  const { error } = updateChannelPartnerSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const channelPartner = await ChannelPartner.findById(req.params.id);
    if (!channelPartner) return res.status(404).json({ message: 'Channel Partner not found' });

    Object.assign(channelPartner, req.body);
    if (req.file) {
      if (channelPartner.photo && fs.existsSync(channelPartner.photo)) {
        fs.unlinkSync(channelPartner.photo);
      }
      channelPartner.photo = req.file.path;
    }
    channelPartner.updatedBy = req.user._id;
    await channelPartner.save();
    res.json(channelPartner);
  } catch (err) {
    if (req.file) fs.unlinkSync(req.file.path);
    console.error('updateChannelPartner - Error:', err.message);
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
    console.error('deleteChannelPartner - Error:', err.message);
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
    console.error('bulkCreateChannelPartners - Error:', err.message);
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
    console.error('bulkUpdateChannelPartners - Error:', err.message);
    res.status(500).json({ message: err.message });
  }
};

const bulkDeleteChannelPartners = async (req, res) => {
  const { error } = bulkDeleteChannelPartnerSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const channelPartners = await ChannelPartner.find(req.body.query).lean();
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
    console.error('bulkDeleteChannelPartners - Error:', err.message);
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