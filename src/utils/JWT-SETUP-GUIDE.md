# JWT Auto-Generation and Rotation Setup Guide

## 🚀 Quick Start

Your JWT auto-generation system is now ready! Here's how to use it:

### Manual Commands

```bash
# Check current status
node src/utils/auto-jwt-manager.js status

# Generate new secrets (replace existing)
node src/utils/auto-jwt-manager.js generate 3

# Add new secrets to existing ones
node src/utils/auto-jwt-manager.js generate 2 --add

# Force rotation now
node src/utils/auto-jwt-manager.js rotate

# Create manual backup
node src/utils/auto-jwt-manager.js backup
```

## ⚙️ Current Configuration

- ✅ **Auto-rotation enabled**: Every 7 days
- ✅ **Backup system enabled**: Automatic backups before changes
- 🔄 **Keep 3 secrets**: For graceful rotation
- 📅 **Last rotation**: Configured

## 🕐 Automated Scheduling

### Option 1: Windows Task Scheduler (Recommended for Windows)

1. Open **Task Scheduler** (taskschd.msc)
2. Create **Basic Task**
3. Name: "JWT Auto-Rotation"
4. Trigger: **Weekly** (every 7 days)
5. Time: **2:00 AM** (low traffic time)
6. Action: **Start a program**
7. Program: `powershell.exe`
8. Arguments: `-ExecutionPolicy Bypass -File "D:\Files\Source\discord\src\utils\jwt-auto-rotation.ps1"`
9. Start in: `D:\Files\Source\discord`

### Option 2: Manual PowerShell

```powershell
# Run once to test
powershell -ExecutionPolicy Bypass -File "src/utils/jwt-auto-rotation.ps1"

# View logs
Get-Content "src/utils/jwt-rotation.log" -Tail 20
```

### Option 3: Node.js Scheduler (Cross-platform)

```bash
# Install scheduler dependency
npm install node-cron

# Run the built-in scheduler
node src/utils/jwt-scheduler.js
```

## 📁 File Structure

```
src/utils/
├── auto-jwt-manager.js      # Main auto-generation system
├── jwt-rotation.js          # Manual rotation utility
├── jwt-scheduler.js         # Node.js scheduler
├── jwt-auto-rotation.ps1    # PowerShell scheduler
├── jwt-auto-rotation.bat    # Batch file scheduler
└── jwt-auto-config.json     # Configuration file (auto-created)

.env.backups/                # Automatic backups
├── .env.backup.2025-08-26T...
└── .env.backup.2025-08-27T...
```

## 🔧 Configuration Options

Edit `src/utils/jwt-auto-config.json` to customize:

```json
{
  "autoRotation": {
    "enabled": true,
    "intervalDays": 7,
    "keepSecretsCount": 3,
    "lastRotation": "2025-08-26T22:14:46.221Z"
  },
  "generation": {
    "secretLength": 64,
    "algorithm": "hex"
  },
  "backup": {
    "enabled": true,
    "maxBackups": 10
  },
  "notifications": {
    "enabled": false,
    "webhook": null
  }
}
```

## 🔐 Security Features

- **Automatic backups**: Every change creates a timestamped backup
- **Graceful rotation**: Old tokens remain valid during transition
- **Secure generation**: Cryptographically secure random bytes
- **Multiple verification**: Supports 2-3 secrets for zero-downtime rotation

## 📊 Monitoring

### Check Status
```bash
node src/utils/auto-jwt-manager.js status
```

### View Logs (PowerShell scheduler)
```bash
Get-Content src/utils/jwt-rotation.log -Tail 20
```

### Application Logs
Your application will log which JWT secret is being used:
```
JWT verified with secret #1/3
JWT verified with secret #2/3
```

## 🚨 Troubleshooting

### If rotation fails:
1. Check `.env.backups/` for automatic backup
2. Verify file permissions on `.env`
3. Check disk space
4. Review logs for specific errors

### Emergency rollback:
```bash
# List backups
ls .env.backups/

# Restore from backup
cp .env.backups/.env.backup.TIMESTAMP .env

# Restart application
npm start
```

### Manual override:
```bash
# Disable auto-rotation temporarily
node -e "const fs=require('fs'); const cfg=JSON.parse(fs.readFileSync('src/utils/jwt-auto-config.json')); cfg.autoRotation.enabled=false; fs.writeFileSync('src/utils/jwt-auto-config.json', JSON.stringify(cfg,null,2));"
```

## ✅ Testing the Setup

1. **Test manual generation**:
   ```bash
   node src/utils/auto-jwt-manager.js generate 1 --add
   ```

2. **Test PowerShell scheduler**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File "src/utils/jwt-auto-rotation.ps1"
   ```

3. **Verify application still works**:
   - Restart your Discord bot
   - Test dashboard authentication
   - Check that old tokens still work

## 🔄 Rotation Schedule

- **Development**: Every 7 days (current setting)
- **Production**: Recommended 30-90 days
- **High Security**: Weekly or bi-weekly

To change interval:
```bash
node src/utils/auto-jwt-manager.js setup 30 3  # 30 days, keep 3 secrets
```

## 📞 Support

If you encounter issues:
1. Check the generated logs
2. Verify `.env` file syntax
3. Test manual rotation first
4. Check file permissions
5. Ensure Node.js can write to project directory

Your JWT system now has enterprise-grade automated rotation! 🔐✨
