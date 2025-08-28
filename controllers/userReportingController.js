const UserReporting = require('../models/UserReporting');
const User = require('../models/User');
const Joi = require('joi');

const relationshipSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  teamType: Joi.string().valid('project', 'global', 'superadmin', 'custom').required(),
  projectId: Joi.string().hex().length(24).when('teamType', { is: 'project', then: Joi.required() }),
  context: Joi.string().allow('')
});

const createReportingSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  reportsTo: Joi.array().items(relationshipSchema).min(1).required()
});

const updateReportingSchema = Joi.object({
  reportsTo: Joi.array().items(relationshipSchema).min(1)
});

const createReporting = async (req, res) => {
  const { error } = createReportingSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const user = await User.findById(req.body.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const reporting = new UserReporting({
      user: req.body.userId,
      reportsTo: req.body.reportsTo.map(r => ({
        user: r.userId,
        teamType: r.teamType,
        project: r.projectId,
        context: r.context
      })),
      level: user.level
    });
    await reporting.save();
    res.status(201).json(reporting);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getHierarchy = async (req, res) => {
  const { userId } = req.params;
  try {
    // Fetch all users reporting to userId (directly or indirectly)
    const subordinates = await UserReporting.find({
      'reportsTo.path': { $regex: `^/${userId}/` }
    }).populate('user reportsTo.user reportsTo.project');
    res.json(subordinates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateReporting = async (req, res) => {
  const { id } = req.params;
  const { error } = updateReportingSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const reporting = await UserReporting.findById(id);
    if (!reporting) return res.status(404).json({ message: 'Reporting not found' });

    reporting.reportsTo = req.body.reportsTo.map(r => ({
      user: r.userId,
      teamType: r.teamType,
      project: r.projectId,
      context: r.context
    }));
    await reporting.save();
    res.json(reporting);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteReporting = async (req, res) => {
  const { id } = req.params;
  try {
    await UserReporting.deleteOne({ _id: id });
    res.json({ message: 'Reporting deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bulkUpdateUserReportings = async (req, res) => {
  const { query, update } = req.body;
  try {
    const result = await UserReporting.updateMany(query, update);
    res.json({ message: 'Bulk update successful', modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bulkDeleteUserReportings = async (req, res) => {
  const { query } = req.body;
  try {
    const result = await UserReporting.deleteMany(query);
    res.json({ message: 'Bulk delete successful', deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { createReporting, getHierarchy, updateReporting, deleteReporting, bulkUpdateUserReportings, bulkDeleteUserReportings };