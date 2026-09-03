const { FormSubmission } = require('../models');
const ApiResponse = require('../helpers/apiResponse');
const logger = require('../helpers/logger');

class FormController {
  /**
   * POST /api/chat/form-submit
   * Handles postbacks from customForms rendered in chatbot widget
   */
  async submitForm(req, res, next) {
    try {
      const { formName, botId = 'ISOBot', tenantId = '', sessionId = '', data, ...rest } = req.body;
      const submissionData = data || rest;

      if (!formName) {
        return ApiResponse.badRequest(res, 'formName is required');
      }

      const submission = new FormSubmission({
        formName,
        botId,
        tenantId,
        sessionId,
        formData: submissionData,
        status: 'received',
        submittedAt: new Date()
      });

      await submission.save();
      logger.info(`Form '${formName}' submitted successfully for botId='${botId}'`);

      return ApiResponse.created(res, submission, 'Form submitted successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/forms/submissions
   * List submitted forms
   */
  async getSubmissions(req, res, next) {
    try {
      const { formName, botId, page = 1, limit = 50 } = req.query;
      const filter = {};
      if (formName) filter.formName = formName;
      if (botId) filter.botId = botId;

      const skip = (page - 1) * limit;
      const [submissions, total] = await Promise.all([
        FormSubmission.find(filter).sort({ submittedAt: -1 }).skip(skip).limit(Number(limit)).lean(),
        FormSubmission.countDocuments(filter)
      ]);

      return ApiResponse.success(res, submissions, 'Form submissions retrieved', 200, {
        pagination: { total, page: Number(page), limit: Number(limit) }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new FormController();
