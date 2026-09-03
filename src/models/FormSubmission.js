const mongoose = require('mongoose');

const FormSubmissionSchema = new mongoose.Schema({
  formName: { type: String, required: true, index: true },
  botId: { type: String, required: true, index: true },
  tenantId: { type: String, default: '' },
  sessionId: { type: String, default: '' },
  formData: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['received', 'processed', 'failed'], default: 'received' },
  submittedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

const FormSubmission = mongoose.models.FormSubmission || mongoose.model('FormSubmission', FormSubmissionSchema);
module.exports = FormSubmission;
