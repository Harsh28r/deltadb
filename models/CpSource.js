const mongoose = require('mongoose');

const cpSourceSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    name: { type: String, required: true, trim: true },
    location: { type: String },
    images: [{ type: String }],
    remarks: [{ type: String }],
    custom: { type: Map, of: mongoose.Schema.Types.Mixed },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CpSource', cpSourceSchema);


