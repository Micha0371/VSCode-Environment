const fs = require('node:fs');
const path = require('node:path');

function redactStartupLog(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, '').split(/\r?\n/).map(line => {
    return line.replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+(?::[^\s/@]*)?@/gi, '$1[credentials redacted]@')
      .replace(/((?:anon[ _-]?key|service[ _-]?role(?:[ _-]?key)?|publishable(?:[ _-]?key)?|secret(?:[ _-]?key)?|api[ _-]?key|authorization|password|access[ _-]?token|refresh[ _-]?token)\s*[:=|]\s*).*/gi, '$1[value redacted]')
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT redacted]')
      .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[key redacted]');
  }).join('\n');
}

module.exports = { redactStartupLog };
if (require.main === module) {
  const file = path.resolve(__dirname, '..', 'db-start.log');
  const output = path.resolve(__dirname, '..', 'db-start.sanitized.log');
  if (fs.existsSync(file)) fs.writeFileSync(output, redactStartupLog(fs.readFileSync(file, 'utf8')));
}
