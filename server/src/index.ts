
import { ScalableSocketServer } from './ScalableSocketServer';

// Start the realtime server
const PORT = parseInt(process.env.PORT || '3001');

console.log('🚀 Starting Agar3.fun Scalable Realtime Server...');
console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔧 Port: ${PORT}`);
console.log(`🆔 Server ID: ${process.env.SERVER_ID || 'auto-generated'}`);
console.log(`📊 Redis Scaling: ${process.env.ENABLE_REDIS === 'true' ? 'ENABLED' : 'DISABLED'}`);

const server = new ScalableSocketServer(PORT);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});
