#!/usr/bin/env node
/**
 * Automated JWT Secret Management System
 * 
 * This script automatically generates JWT secrets and updates the .env file.
 * Can be run manually or set up as a scheduled task/cron job.
 * 
 * Features:
 * - Auto-generates secure JWT secrets
 * - Updates .env file safely
 * - Supports rotation schedules
 * - Backup and rollback capability
 * - Environment validation
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AutoJWTManager {
  constructor() {
    this.envPath = path.join(__dirname, '../../.env');
    this.backupDir = path.join(__dirname, '../../.env.backups');
    this.configPath = path.join(__dirname, 'jwt-auto-config.json');
    
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    
    this.config = this.loadConfig();
  }

  loadConfig() {
    const defaultConfig = {
      autoRotation: {
        enabled: false,
        intervalDays: 30,
        keepSecretsCount: 3,
        lastRotation: null
      },
      generation: {
        secretLength: 64, // bytes (will be 128 hex chars)
        algorithm: 'hex',
        entropy: 'crypto.randomBytes'
      },
      backup: {
        enabled: true,
        maxBackups: 10,
        compressionEnabled: false
      },
      notifications: {
        enabled: false,
        webhook: null,
        email: null
      }
    };

    try {
      if (fs.existsSync(this.configPath)) {
        const userConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        return { ...defaultConfig, ...userConfig };
      }
    } catch (error) {
      console.warn('⚠️  Config file corrupted, using defaults:', error.message);
    }

    return defaultConfig;
  }

  saveConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      return true;
    } catch (error) {
      console.error('❌ Failed to save config:', error.message);
      return false;
    }
  }

  generateSecureSecret() {
    const bytes = this.config.generation.secretLength;
    const algorithm = this.config.generation.algorithm;
    
    switch (algorithm) {
      case 'hex':
        return crypto.randomBytes(bytes).toString('hex');
      case 'base64':
        return crypto.randomBytes(bytes).toString('base64').replace(/[+/=]/g, '');
      case 'base64url':
        return crypto.randomBytes(bytes).toString('base64url');
      default:
        return crypto.randomBytes(bytes).toString('hex');
    }
  }

  createBackup() {
    if (!this.config.backup.enabled) {
      return null;
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupDir, `.env.backup.${timestamp}`);
      
      if (fs.existsSync(this.envPath)) {
        fs.copyFileSync(this.envPath, backupPath);
        console.log(`📦 Backup created: ${path.basename(backupPath)}`);
        
        // Cleanup old backups
        this.cleanupOldBackups();
        
        return backupPath;
      }
    } catch (error) {
      console.error('❌ Backup failed:', error.message);
    }
    
    return null;
  }

  cleanupOldBackups() {
    try {
      const backupFiles = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('.env.backup.'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          mtime: fs.statSync(path.join(this.backupDir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      const maxBackups = this.config.backup.maxBackups;
      if (backupFiles.length > maxBackups) {
        const filesToDelete = backupFiles.slice(maxBackups);
        filesToDelete.forEach(file => {
          fs.unlinkSync(file.path);
          console.log(`🗑️  Removed old backup: ${file.name}`);
        });
      }
    } catch (error) {
      console.warn('⚠️  Backup cleanup failed:', error.message);
    }
  }

  getCurrentSecrets() {
    try {
      // Load .env file manually to avoid dotenv caching
      const envContent = fs.readFileSync(this.envPath, 'utf8');
      const match = envContent.match(/DASHBOARD_JWT_SECRET=(.+)/);
      
      if (match) {
        return match[1].split(',').map(s => s.trim()).filter(s => s.length > 0);
      }
    } catch (error) {
      console.warn('⚠️  Could not read current secrets:', error.message);
    }
    
    return [];
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
      return false;
    }
  }

  autoGenerate(options = {}) {
    const {
      secretCount = 1,
      addToCurrent = false,
      keepCount = this.config.autoRotation.keepSecretsCount
    } = options;

    console.log('🤖 Auto-generating JWT secrets...');
    
    // Create backup
    const backupPath = this.createBackup();
    
    try {
      const currentSecrets = addToCurrent ? this.getCurrentSecrets() : [];
      const newSecrets = [];
      
      // Generate new secrets
      for (let i = 0; i < secretCount; i++) {
        const secret = this.generateSecureSecret();
        newSecrets.push(secret);
        console.log(`🔑 Generated secret ${i + 1}/${secretCount}: ${secret.substring(0, 16)}...${secret.substring(secret.length - 16)}`);
      }
      
      // Combine and limit
      const allSecrets = [...newSecrets, ...currentSecrets].slice(0, keepCount);
      
      // Update .env file
      if (this.updateEnvFile(allSecrets)) {
        console.log(`✅ Auto-generation completed! Total secrets: ${allSecrets.length}`);
        
        // Update last rotation time if this was a rotation
        if (addToCurrent) {
          this.config.autoRotation.lastRotation = new Date().toISOString();
          this.saveConfig();
        }
        
        // Send notifications if enabled
        this.sendNotification('JWT secrets auto-generated successfully', {
          secretCount: allSecrets.length,
          newSecretsCount: newSecrets.length,
          timestamp: new Date().toISOString()
        });
        
        return {
          success: true,
          secrets: allSecrets,
          newSecrets: newSecrets,
          backupPath: backupPath
        };
      } else {
        throw new Error('Failed to update .env file');
      }
      
    } catch (error) {
      console.error('❌ Auto-generation failed:', error.message);
      
      // Restore backup if available
      if (backupPath && fs.existsSync(backupPath)) {
        try {
          fs.copyFileSync(backupPath, this.envPath);
          console.log('🔄 Restored from backup');
        } catch (restoreError) {
          console.error('❌ Backup restoration failed:', restoreError.message);
        }
      }
      
      return {
        success: false,
        error: error.message,
        backupPath: backupPath
      };
    }
  }

  autoRotate() {
    if (!this.config.autoRotation.enabled) {
      console.log('ℹ️  Auto-rotation is disabled');
      return { success: false, reason: 'disabled' };
    }

    const lastRotation = this.config.autoRotation.lastRotation;
    const intervalMs = this.config.autoRotation.intervalDays * 24 * 60 * 60 * 1000;
    
    if (lastRotation) {
      const timeSinceRotation = Date.now() - new Date(lastRotation).getTime();
      if (timeSinceRotation < intervalMs) {
        const daysUntilNext = Math.ceil((intervalMs - timeSinceRotation) / (24 * 60 * 60 * 1000));
        console.log(`ℹ️  Next rotation in ${daysUntilNext} days`);
        return { success: false, reason: 'too_soon', daysUntilNext };
      }
    }

    console.log('🔄 Starting automatic rotation...');
    return this.autoGenerate({ 
      secretCount: 1, 
      addToCurrent: true,
      keepCount: this.config.autoRotation.keepSecretsCount 
    });
  }

  sendNotification(message, data = {}) {
    if (!this.config.notifications.enabled) {
      return;
    }

    // Webhook notification
    if (this.config.notifications.webhook) {
      try {
        const webhook = require('child_process').spawn('curl', [
          '-X', 'POST',
          '-H', 'Content-Type: application/json',
          '-d', JSON.stringify({ text: message, data }),
          this.config.notifications.webhook
        ]);
        console.log('📡 Notification sent to webhook');
      } catch (error) {
        console.warn('⚠️  Webhook notification failed:', error.message);
      }
    }

    // Log notification (always)
    console.log(`📢 ${message}`, data);
  }

  initializeEnv() {
    console.log('🚀 Initializing .env with JWT secrets...');
    
    if (!fs.existsSync(this.envPath)) {
      console.log('📝 Creating new .env file...');
      fs.writeFileSync(this.envPath, '# Discord Bot Environment Variables\n\n');
    }

    const currentSecrets = this.getCurrentSecrets();
    if (currentSecrets.length === 0) {
      console.log('🔑 No JWT secrets found, generating initial set...');
      return this.autoGenerate({ secretCount: 3 });
    } else {
      console.log(`ℹ️  Found ${currentSecrets.length} existing JWT secret(s)`);
      return { success: true, secrets: currentSecrets, newSecrets: [] };
    }
  }

  setupAutoRotation(intervalDays = 30, keepCount = 3) {
    this.config.autoRotation = {
      enabled: true,
      intervalDays: intervalDays,
      keepSecretsCount: keepCount,
      lastRotation: new Date().toISOString()
    };

    if (this.saveConfig()) {
      console.log(`✅ Auto-rotation enabled: every ${intervalDays} days, keeping ${keepCount} secrets`);
      
      // Create a simple scheduler script
      this.createSchedulerScript();
      
      return true;
    }

    return false;
  }

  createSchedulerScript() {
    const schedulerPath = path.join(__dirname, 'jwt-scheduler.js');
    const schedulerContent = `#!/usr/bin/env node
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
`;

    try {
      fs.writeFileSync(schedulerPath, schedulerContent);
      fs.chmodSync(schedulerPath, '755');
      console.log(`📅 Scheduler script created: ${schedulerPath}`);
      console.log('💡 Add to crontab: 0 2 * * * /usr/bin/node ' + schedulerPath);
    } catch (error) {
      console.warn('⚠️  Could not create scheduler script:', error.message);
    }
  }

  status() {
    console.log('🔐 Auto JWT Manager Status\n');
    
    const currentSecrets = this.getCurrentSecrets();
    console.log(`📊 Current secrets: ${currentSecrets.length}`);
    
    if (currentSecrets.length > 0) {
      currentSecrets.forEach((secret, index) => {
        const role = index === 0 ? '(PRIMARY)' : '(BACKUP)';
      });
    }
    
    console.log('\n⚙️  Configuration:');
    console.log(`  Auto-rotation: ${this.config.autoRotation.enabled ? '✅ Enabled' : '❌ Disabled'}`);
    if (this.config.autoRotation.enabled) {
      console.log(`  Interval: ${this.config.autoRotation.intervalDays} days`);
      console.log(`  Keep count: ${this.config.autoRotation.keepSecretsCount}`);
      console.log(`  Last rotation: ${this.config.autoRotation.lastRotation || 'Never'}`);
    }
    console.log(`  Backups: ${this.config.backup.enabled ? '✅ Enabled' : '❌ Disabled'}`);
    console.log(`  Notifications: ${this.config.notifications.enabled ? '✅ Enabled' : '❌ Disabled'}`);
  }
}

// CLI Interface
function main() {
  const [,, command, ...args] = process.argv;
  const manager = new AutoJWTManager();
  
  switch (command) {
    case 'init':
      manager.initializeEnv();
      break;
      
    case 'generate':
      const count = parseInt(args[0]) || 1;
      const addToCurrent = args.includes('--add');
      manager.autoGenerate({ 
        secretCount: count, 
        addToCurrent: addToCurrent 
      });
      break;
      
    case 'rotate':
      manager.autoRotate();
      break;
      
    case 'setup':
      const intervalDays = parseInt(args[0]) || 30;
      const keepCount = parseInt(args[1]) || 3;
      manager.setupAutoRotation(intervalDays, keepCount);
      break;
      
    case 'status':
      manager.status();
      break;
      
    case 'backup':
      manager.createBackup();
      break;
      
    default:
      console.log('🤖 Auto JWT Manager\n');
      console.log('Usage: node src/utils/auto-jwt-manager.js [command] [options]\n');
      console.log('Commands:');
      console.log('  init                     - Initialize .env with JWT secrets');
      console.log('  generate [count] [--add] - Generate new secrets');
      console.log('  rotate                   - Perform rotation if due');
      console.log('  setup [days] [keep]      - Setup auto-rotation (default: 30 days, keep 3)');
      console.log('  status                   - Show current status');
      console.log('  backup                   - Create manual backup');
      console.log('\nExamples:');
      console.log('  node src/utils/auto-jwt-manager.js init');
      console.log('  node src/utils/auto-jwt-manager.js generate 2 --add');
      console.log('  node src/utils/auto-jwt-manager.js setup 14 2');
      console.log('  node src/utils/auto-jwt-manager.js rotate');
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = AutoJWTManager;
