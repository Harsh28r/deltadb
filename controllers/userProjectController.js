const UserProject = require('../models/UserProject');
const Joi = require('joi');

const schema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  projectId: Joi.string().hex().length(24).required(),
});

const assignProject = async (req, res) => {
  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const assignment = new UserProject(req.body);
    await assignment.save();
    res.status(201).json(assignment);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Duplicate assignment' });
    res.status(500).json({ message: err.message });
  }
};

const getUserProjects = async (req, res) => {
  const { userId } = req.params;
  const projects = await UserProject.find({ user: userId }).populate('project roleInProject');
  res.json(projects);
};

const removeProject = async (req, res) => {
  const { userId, projectId } = req.params;
  await UserProject.deleteOne({ user: userId, project: projectId });
  res.json({ message: 'Assignment removed' });
};

const bulkUpdateUserProjects = async (req, res) => {
  const { query, update } = req.body;
  try {
    const result = await UserProject.updateMany(query, update);
    res.json({ message: 'Bulk update successful', modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const bulkDeleteUserProjects = async (req, res) => {
  const { query } = req.body;
  try {
    const result = await UserProject.deleteMany(query);
    res.json({ message: 'Bulk delete successful', deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { assignProject, getUserProjects, removeProject, bulkUpdateUserProjects, bulkDeleteUserProjects };