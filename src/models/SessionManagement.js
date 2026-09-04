const mongoose = require('mongoose');

const SessionManagementSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true, index: true },
  tenantId: { type: String, default: null, index: true },
  tenantName: { type: String, default: null },
  role: { type: String, default: 'global_admin' },
  fullName: { type: String, default: '' },
  email: { type: String, default: '' },
  loginTime: { type: Date, default: Date.now },
  lastActivityTime: { type: Date, default: Date.now },
  logoutTime: { type: Date, default: null },
  logoutReason: { type: String, default: null },
  isActive: { type: Boolean, default: true, index: true },
  ipAddress: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
  timestamps: true,
  collection: 'sessionManagement'
});

// TTL Index: Automatically auto-delete any session from MongoDB after 2 hours (7200 seconds) of inactivity
SessionManagementSchema.index({ lastActivityTime: 1 }, { expireAfterSeconds: 7200 });

const SessionManagement = mongoose.models.SessionManagement || mongoose.model('SessionManagement', SessionManagementSchema);
module.exports = SessionManagement;
