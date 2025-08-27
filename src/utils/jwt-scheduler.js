#!/usr/bin/env node
// Automated JWT Rotation Scheduler
const AutoJWTManager = require('./auto-jwt-manager');

const manager = new AutoJWTManager();

console.log('🕐 Running scheduled JWT rotation check...');
const result = manager.autoRotate();

if (result.success) {
  console.log('✅ Scheduled rotation completed successfully');
  process.exit(0);
} else {
  console.log('ℹ️  Scheduled rotation: ' + (result.reason || 'skipped'));
  process.exit(0);
}
