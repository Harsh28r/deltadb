const CpSource = require('../models/CpSource');

// Create CP Source (optionally under a project)
const createCpSource = async (req, res) => {
  try {
    const { name, projectId, location, images, remarks, custom } = req.body || {};
    if (!name) {
      return res.status(400).json({ message: 'name is required' });
    }

    if (projectId) {
      const project = await require('../models/Project').findById(projectId);
      if (!project) return res.status(404).json({ message: 'Project not found' });
    }

    const doc = await CpSource.create({
      project: projectId || null,
      name,
      location,
      images: Array.isArray(images) ? images : [],
      remarks: Array.isArray(remarks) ? remarks : [],
      custom: custom || {},
      createdBy: req.user?._id,
    });
    res.status(201).json(doc);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Get all CP Sources
const getAllCpSources = async (req, res) => {
  try {
    const docs = await CpSource.find({}).sort({ createdAt: -1 });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// List CP Sources for a project
const listCpSources = async (req, res) => {
  try {
    const projectId = req.params.projectId || req.query.projectId || req.body.projectId;
    if (!projectId) return res.status(400).json({ message: 'projectId is required' });
    const docs = await CpSource.find({ project: projectId }).sort({ createdAt: -1 });
    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Update a CP Source
const updateCpSource = async (req, res) => {
  try {
    const { id } = req.params;
    const cp = await CpSource.findById(id);
    if (!cp) return res.status(404).json({ message: 'CP Source not found' });

    const { name, location, images, remarks, addRemark, removeRemarkIndex, customSet, customUnsetKeys } = req.body || {};
    if (typeof name === 'string') cp.name = name;
    if (typeof location === 'string') cp.location = location;
    if (Array.isArray(images)) cp.images = images;
    if (Array.isArray(remarks)) cp.remarks = remarks;
    if (typeof addRemark === 'string' && addRemark.trim()) {
      cp.remarks = cp.remarks || [];
      cp.remarks.push(addRemark.trim());
    }
    if (Number.isInteger(removeRemarkIndex) && cp.remarks && cp.remarks[removeRemarkIndex] !== undefined) {
      cp.remarks.splice(removeRemarkIndex, 1);
    }
    if (customSet && typeof customSet === 'object') {
      cp.custom = cp.custom || {};
      for (const [k, v] of Object.entries(customSet)) {
        cp.custom.set ? cp.custom.set(k, v) : (cp.custom[k] = v);
      }
    }
    if (Array.isArray(customUnsetKeys)) {
      for (const key of customUnsetKeys) {
        if (cp.custom?.delete) cp.custom.delete(key);
        else if (cp.custom && cp.custom[key] !== undefined) delete cp.custom[key];
      }
    }
    if (req.user?._id) {
      cp.updatedBy = req.user._id;
    }
    await cp.save();
    res.json(cp);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// Delete a CP Source
const deleteCpSource = async (req, res) => {
  try {
    const { id } = req.params;
    const cp = await CpSource.findById(id);
    if (!cp) return res.status(404).json({ message: 'CP Source not found' });
    await cp.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

module.exports = { createCpSource, getAllCpSources, listCpSources, updateCpSource, deleteCpSource };


