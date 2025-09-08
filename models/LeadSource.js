const mongoose = require('mongoose');

const leadSourceSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true }
}, { timestamps: true });

// Case-insensitive unique index
leadSourceSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

// Block variations of "Channel Partner", but allow exact "Channel Partner"
leadSourceSchema.pre('save', async function (next) {
  const rawName = this.name.trim();

  // ✅ allow exactly "Channel Partner"
  if (rawName === "Channel Partner") {
    return next();
  }

  // Normalize (lowercase + strip spaces, dashes, underscores, dots)
  const normalized = rawName
    .toLowerCase()
    .replace(/[^a-z0-9]/gi, '') // remove all non-alphanumeric chars
    .trim();

  const forbidden = [
    "channelpartner",
    "channelpartners",
    "channelpartnersource",
    "channelpartnerlead",
    "cpsource",
    "cp",
    "cps",
    "cplead",
    "cpleads"
  ];

  if (forbidden.includes(normalized)) {
    return next(new Error('Lead source name cannot be a variation of "Channel Partner"'));
  }

  next();
});

module.exports = mongoose.model('LeadSource', leadSourceSchema);
