import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling']
});

export const joinSessionRoom = (sessionId) => socket.emit('join_session', sessionId);
export const joinTokenRoom = (tokenId) => socket.emit('join_token', tokenId);
export const joinDisplayRoom = (hospitalId) => socket.emit('join_display', hospitalId);
