#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Démarrage du serveur Agar3.fun...');

// Chemin vers le point d'entrée TypeScript
const serverEntry = path.join(__dirname, 'src', 'index.ts');

// Commande pour démarrer le serveur avec ts-node
const serverProcess = spawn('npx', ['ts-node', serverEntry], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || '3001',
    SERVER_ID: process.env.SERVER_ID || 'agar3-server-1',
    ENABLE_REDIS: process.env.ENABLE_REDIS || 'false'
  }
});

serverProcess.on('error', (error) => {
  console.error('❌ Erreur lors du démarrage du serveur:', error.message);
  process.exit(1);
});

serverProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Serveur arrêté avec le code: ${code}`);
  } else {
    console.log('✅ Serveur arrêté proprement');
  }
  process.exit(code);
});

// Gestion des signaux pour un arrêt propre
process.on('SIGTERM', () => {
  console.log('🛑 Signal SIGTERM reçu, arrêt du serveur...');
  serverProcess.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('🛑 Signal SIGINT reçu, arrêt du serveur...');
  serverProcess.kill('SIGINT');
});