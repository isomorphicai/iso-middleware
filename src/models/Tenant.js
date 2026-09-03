const mongoose = require('mongoose');

const TenantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, lowercase: true, trim: true },
  description: { type: String, default: '' },
  active: { type: Boolean, default: true },
  settings: {
    allowedDomains: [{ type: String }],
    maxBots: { type: Number, default: 10 },
    theme: { type: String, default: 'default' }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

const Tenant = mongoose.models.Tenant || mongoose.model('Tenant', TenantSchema);
module.exports = Tenant;
