let ioInstance = null;

class RealtimeService {
  static init(server) {
    const { Server } = require('socket.io');
    ioInstance = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    ioInstance.on('connection', (socket) => {
      // Room subscription based on session/OPD
      socket.on('join_session', (sessionId) => {
        socket.join(`session_${sessionId}`);
      });

      // Individual patient token room for private notifications
      socket.on('join_token', (tokenId) => {
        socket.join(`token_${tokenId}`);
      });

      // Public display board room
      socket.on('join_display', (hospitalId) => {
        socket.join(`display_${hospitalId}`);
      });

      // Phone room for custom phone number live SMS simulation
      socket.on('join_phone', (phone) => {
        if (phone) {
          const cleanPhone = String(phone).replace(/[^0-9]/g, '');
          socket.join(`phone_${cleanPhone}`);
        }
      });
    });

    console.log('[RealtimeService] Socket.IO server initialized.');
    return ioInstance;
  }

  static getIO() {
    return ioInstance;
  }

  /**
   * Broadcast real-time SMS notification to patient's token, phone room, and global feed
   */
  static emitSMSNotification(smsData) {
    if (!ioInstance) return;
    const payload = {
      timestamp: new Date().toISOString(),
      ...smsData
    };

    if (smsData.tokenId) {
      ioInstance.to(`token_${smsData.tokenId}`).emit('sms_notification', payload);
    }
    if (smsData.recipientPhone) {
      const cleanPhone = String(smsData.recipientPhone).replace(/[^0-9]/g, '');
      ioInstance.to(`phone_${cleanPhone}`).emit('sms_notification', payload);
    }
    ioInstance.emit('global_sms_notification', payload);
  }

  /**
   * Broadcast updated queue state to session subscribers
   */
  static emitQueueUpdate(sessionId, eventType, data) {
    if (!ioInstance) return;
    ioInstance.to(`session_${sessionId}`).emit('queue_update', {
      eventType,
      sessionId,
      timestamp: new Date().toISOString(),
      data
    });
  }

  /**
   * Send private ETA update to a single patient
   */
  static emitTokenETA(tokenId, data) {
    if (!ioInstance) return;
    ioInstance.to(`token_${tokenId}`).emit('token_eta_update', {
      tokenId,
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  /**
   * Broadcast sanitized display board update
   */
  static emitDisplayBoard(hospitalId, data) {
    if (!ioInstance) return;
    ioInstance.to(`display_${hospitalId}`).emit('display_board_update', {
      timestamp: new Date().toISOString(),
      ...data
    });
  }
}

module.exports = RealtimeService;
