const { AuditLog } = require('../models');

class AuditService {
  /**
   * Log system/security/queue events
   */
  static async log({
    actorId = null,
    actorRole = 'SYSTEM',
    action,
    entity,
    entityId,
    reason = null,
    previousState = null,
    newState = null,
    ipAddress = null,
    userAgent = null,
    metadata = {}
  }) {
    try {
      const logEntry = new AuditLog({
        actorId,
        actorRole,
        action,
        entity,
        entityId: String(entityId),
        reason,
        previousState,
        newState,
        ipAddress,
        userAgent,
        metadata
      });
      await logEntry.save();
      return logEntry;
    } catch (error) {
      console.error('[AuditService] Failed to record audit log:', error.message);
      // Never crash the primary workflow due to audit recording failure
      return null;
    }
  }
}

module.exports = AuditService;
