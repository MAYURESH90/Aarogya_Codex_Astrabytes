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
    });

    console.log('[RealtimeService] Socket.IO server initialized.');
    return ioInstance;
  }

  static getIO() {
    return ioInstance;
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
