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
  password: { type: String, required: true },
  role: { type: String, default: 'superadmin' },
  roleRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  level: { type: Number, default: 3 },
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);