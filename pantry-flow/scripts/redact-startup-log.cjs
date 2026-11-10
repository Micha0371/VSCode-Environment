const fs = require('node:fs');
const path = require('node:path');

function redactStartupLog(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/).map(line => {
    if (/anon.?key|service.?role|publishable|secret|api.?key|authorization|password|access.?token|refresh.?token/i.test(line)) {
      return '[credential-related startup line redacted]';
    }
    return line.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT redacted]')
      .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[key redacted]');
  }).join('\n');
}

module.exports = { redactStartupLog };
if (require.main === module) {
  const file = path.resolve(__dirname, '..', 'db-start.log');
  const output = path.resolve(__dirname, '..', 'db-start.sanitized.log');
  if (fs.existsSync(file)) fs.writeFileSync(output, redactStartupLog(fs.readFileSync(file, 'utf8')));
}
