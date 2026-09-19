import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
  timeout: 10000,
  transports: ['websocket', 'polling']
});

export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

export const joinSessionRoom = (sessionId) => {
  if (!sessionId) return;
  connectSocket();
  socket.emit('join_session', sessionId);
};

export const joinTokenRoom = (tokenId) => {
  if (!tokenId) return;
  connectSocket();
  socket.emit('join_token', tokenId);
};

export const joinDisplayRoom = (hospitalId) => {
  if (!hospitalId) return;
  connectSocket();
  socket.emit('join_display', hospitalId);
};

socket.on('connect_error', (error) => {
  // Silent fallback to avoid console flooding when backend server is restarting
  console.warn('Live queue socket connecting in background...');
});

export default socket;
