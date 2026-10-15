const crypto = require('crypto');

// ID único generado en cada arranque/reinicio del servidor backend
const SERVER_BOOT_ID = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
const SERVER_BOOT_TIME = Date.now();

console.log(`[Seguridad] Servidor iniciado con Boot ID: ${SERVER_BOOT_ID.substring(0, 8)}... (${new Date(SERVER_BOOT_TIME).toLocaleTimeString()})`);

module.exports = {
  SERVER_BOOT_ID,
  SERVER_BOOT_TIME
};
