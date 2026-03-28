#!/usr/bin/env node
/**
 * Generate VAPID keys for Web Push. Add to .env:
 *   VAPID_PUBLIC_KEY=<public key>
 *   VAPID_PRIVATE_KEY=<private key>
 */
const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();
console.log('Add these to your .env (backend):\n');
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
