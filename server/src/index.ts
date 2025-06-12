
import { SocketServer } from './SocketServer';

// Start the realtime server
const PORT = parseInt(process.env.PORT || '3001');

console.log('🚀 Starting Agar3.fun Realtime Server...');
console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔧 Port: ${PORT}`);

const server = new SocketServer(PORT);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});
