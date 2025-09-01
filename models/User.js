const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: function (v) {
        // Enforce @deltayards.com for superadmins
        if (this.role === 'superadmin' && !v.endsWith('@deltayards.com')) {
          return false;
        }
        return /\S+@\S+\.\S+/.test(v); // Basic email format check
      },
      message: props =>
        props.value.endsWith('@deltayards.com')
          ? 'Invalid email format'
          : 'Superadmin email must end with @deltayards.com',
    },
  },
  mobile: { type: String, required: false },
  companyName: { type: String, required: false },
  password: { type: String, required: false }, // Temporarily not required
  role: { type: String, required: true },
  roleRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  level: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Password hashing removed for testing

userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password || !enteredPassword) return false;
  return this.password === enteredPassword; // Direct string comparison for testing
};

module.exports = mongoose.model('User', userSchema);