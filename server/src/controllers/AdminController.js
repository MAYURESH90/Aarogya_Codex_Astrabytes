const { SystemConfiguration, AuditLog, Hospital, OPD, Doctor, OPDSession } = require('../models');
const AuditService = require('../services/AuditService');

class AdminController {
  static async getConfiguration(req, res, next) {
    try {
      const config = await SystemConfiguration.findOne() || {};
      res.json({ success: true, data: config });
    } catch (error) {
      next(error);
    }
  }

  static async updateConfiguration(req, res, next) {
    try {
      const updates = req.body;
      let config = await SystemConfiguration.findOne();
      if (!config) {
        config = new SystemConfiguration(updates);
      } else {
        Object.assign(config, updates);
      }
      await config.save();

      await AuditService.log({
        actorId: req.user._id,
        actorRole: 'ADMIN',
        action: 'UPDATE_SYSTEM_CONFIGURATION',
        entity: 'CONFIGURATION',
        entityId: String(config._id),
        metadata: updates
      });

      res.json({
        success: true,
        message: 'System configuration updated successfully.',
        data: config
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAuditLogs(req, res, next) {
    try {
      const { entity, action, limit = 50 } = req.query;
      const query = {};
      if (entity) query.entity = entity;
      if (action) query.action = action;

      const logs = await AuditLog.find(query)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit, 10));

      res.json({
        success: true,
        count: logs.length,
        data: logs
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AdminController;
