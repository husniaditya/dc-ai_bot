#!/usr/bin/env node
/**
 * JWT Key Rotation Utility
 * 
 * This script helps manage JWT secret rotation for the Discord bot dashboard.
 * 
 * Usage:
 *   node src/utils/jwt-rotation.js [command] [options]
 * 
 * Commands:
 *   generate     - Generate new JWT secrets
 *   rotate       - Add a new secret to rotation (keeps existing secrets)
 *   replace      - Replace all secrets with new ones
 *   status       - Show current JWT secret configuration
 *   cleanup      - Remove old secrets (keep only the first N)
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

class JWTRotationManager {
  constructor() {
    this.envPath = path.join(__dirname, '../../.env');
    this.currentSecrets = this.getCurrentSecrets();
  }

  getCurrentSecrets() {
    const raw = process.env.DASHBOARD_JWT_SECRET || '';
    return raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  generateSecret() {
    return crypto.randomBytes(64).toString('hex');
  }

  updateEnvFile(newSecrets) {
    try {
      let envContent = fs.readFileSync(this.envPath, 'utf8');
      const newSecretsString = newSecrets.join(',');
      
      const jwtSecretRegex = /DASHBOARD_JWT_SECRET=.*/;
      const newLine = `DASHBOARD_JWT_SECRET=${newSecretsString}`;
      
      if (jwtSecretRegex.test(envContent)) {
        envContent = envContent.replace(jwtSecretRegex, newLine);
        console.log('✅ Updated DASHBOARD_JWT_SECRET in .env file');
      } else {
        envContent += `\n${newLine}\n`;
        console.log('✅ Added DASHBOARD_JWT_SECRET to .env file');
      }
      
      fs.writeFileSync(this.envPath, envContent);
      return true;
    } catch (error) {
      console.error('❌ Error updating .env file:', error.message);
      console.log('\n📝 Please manually update your .env file with:');
      console.log(`DASHBOARD_JWT_SECRET=${newSecrets.join(',')}`);
      return false;
    }
  }

  status() {
    console.log('🔐 Current JWT Secret Configuration:');
    console.log(`📊 Total secrets: ${this.currentSecrets.length}`);
    
    this.currentSecrets.forEach((secret, index) => {
      const role = index === 0 ? '(PRIMARY - used for signing)' : '(verification only)';
      console.log(`  ${index + 1}. ${secret.substring(0, 16)}...${secret.substring(secret.length - 16)} ${role}`);
      console.log(`     Length: ${secret.length} chars`);
    });
    
    if (this.currentSecrets.length === 0) {
      console.log('⚠️  No JWT secrets found! Dashboard authentication will not work.');
    } else if (this.currentSecrets.length === 1) {
      console.log('ℹ️  Single secret mode - no rotation capability.');
    } else {
      console.log(`✅ Rotation enabled with ${this.currentSecrets.length} secrets.`);
    }
  }

  generate(count = 1) {
    console.log(`🔑 Generating ${count} new JWT secret${count > 1 ? 's' : ''}:`);
    
    const newSecrets = [];
    for (let i = 0; i < count; i++) {
      const secret = this.generateSecret();
      newSecrets.push(secret);
      console.log(`  ${i + 1}. ${secret}`);
    }
    
    console.log(`\n📏 Each secret: 128 characters (512-bit entropy)`);
    return newSecrets;
  }

  rotate(keepCount = 2) {
    const newSecret = this.generateSecret();
    const newSecrets = [newSecret, ...this.currentSecrets].slice(0, keepCount);
    
    console.log('🔄 Rotating JWT secrets...');
    console.log(`🆕 New primary secret: ${newSecret.substring(0, 16)}...${newSecret.substring(newSecret.length - 16)}`);
    console.log(`📚 Keeping ${newSecrets.length} total secrets for backward compatibility`);
    
    if (this.updateEnvFile(newSecrets)) {
      console.log('✅ JWT rotation completed successfully!');
      console.log('\n⚠️  Important notes:');
      console.log('• New tokens will be signed with the new primary secret');
      console.log('• Old tokens remain valid during transition period');
      console.log('• Restart your application to load the new configuration');
      return true;
    }
    return false;
  }

  replace(count = 3) {
    const newSecrets = [];
    for (let i = 0; i < count; i++) {
      newSecrets.push(this.generateSecret());
    }
    
    console.log(`🔄 Replacing all JWT secrets with ${count} new ones...`);
    console.log('⚠️  This will invalidate ALL existing tokens!');
    
    if (this.updateEnvFile(newSecrets)) {
      console.log('✅ JWT secrets replaced successfully!');
      console.log('\n⚠️  Important notes:');
      console.log('• ALL existing JWT tokens are now invalid');
      console.log('• All users must log in again');
      console.log('• Restart your application immediately');
      return true;
    }
    return false;
  }

  cleanup(keepCount = 2) {
    if (this.currentSecrets.length <= keepCount) {
      console.log(`ℹ️  Already have ${this.currentSecrets.length} secrets (≤ ${keepCount}), no cleanup needed.`);
      return false;
    }
    
    const newSecrets = this.currentSecrets.slice(0, keepCount);
    const removedCount = this.currentSecrets.length - keepCount;
    
    console.log(`🧹 Cleaning up JWT secrets: keeping ${keepCount}, removing ${removedCount}...`);
    
    if (this.updateEnvFile(newSecrets)) {
      console.log(`✅ Cleanup completed! Removed ${removedCount} old secret(s).`);
      console.log('\n⚠️  Tokens signed with removed secrets will become invalid!');
      return true;
    }
    return false;
  }
}

// CLI Interface
function main() {
  const [,, command, ...args] = process.argv;
  const manager = new JWTRotationManager();
  
  switch (command) {
    case 'status':
      manager.status();
      break;
      
    case 'generate':
      const count = parseInt(args[0]) || 1;
      manager.generate(count);
      break;
      
    case 'rotate':
      const keepCount = parseInt(args[0]) || 2;
      manager.rotate(keepCount);
      break;
      
    case 'replace':
      const newCount = parseInt(args[0]) || 3;
      console.log('⚠️  This will invalidate ALL existing tokens!');
      console.log('Continue? (y/N):');
      
      // Simple confirmation for replace command
      if (args.includes('--yes') || args.includes('-y')) {
        manager.replace(newCount);
      } else {
        console.log('❌ Aborted. Use --yes flag to confirm replacement.');
      }
      break;
      
    case 'cleanup':
      const cleanupKeep = parseInt(args[0]) || 2;
      manager.cleanup(cleanupKeep);
      break;
      
    default:
      console.log('🔐 JWT Key Rotation Utility\n');
      console.log('Usage: node src/utils/jwt-rotation.js [command] [options]\n');
      console.log('Commands:');
      console.log('  status                    - Show current JWT configuration');
      console.log('  generate [count]          - Generate new secrets (default: 1)');
      console.log('  rotate [keep_count]       - Add new secret, keep old ones (default: 2)');
      console.log('  replace [count] --yes     - Replace all secrets (default: 3)');
      console.log('  cleanup [keep_count]      - Remove old secrets (default: keep 2)');
      console.log('\nExamples:');
      console.log('  node src/utils/jwt-rotation.js status');
      console.log('  node src/utils/jwt-rotation.js rotate 3');
      console.log('  node src/utils/jwt-rotation.js replace 2 --yes');
      console.log('  node src/utils/jwt-rotation.js cleanup 1');
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = JWTRotationManager;
