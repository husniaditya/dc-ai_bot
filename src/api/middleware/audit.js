const fs = require('fs');
const path = require('path');

const auditPath = path.join(__dirname, '../../dashboard-audit.log');

function audit(req, body) {
  const line = JSON.stringify({ 
    time: new Date().toISOString(), 
    ip: req.ip, 
    user: req.user && req.user.user, 
    method: req.method, 
    path: req.originalUrl, 
    body 
  }) + '\n';
  
  fs.appendFile(auditPath, line, () => {});
}

module.exports = { audit };
