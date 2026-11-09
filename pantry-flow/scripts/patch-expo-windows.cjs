// Expo 58.0.12 passes a Windows path to tinyglobby as a glob pattern.
// Backslashes are glob escapes, which makes prebuild scan the wrong tree.
// Use the same relative-pattern/cwd form as Expo's Android Paths module.
const fs = require('node:fs');
if (process.platform === 'win32') {
  const manifest = require.resolve('@expo/config-plugins/package.json');
  const version = JSON.parse(fs.readFileSync(manifest, 'utf8')).version;
  const file = require('node:path').join(require('node:path').dirname(manifest), 'build/android/Package.js');
  const before = '(0, _tinyglobby().globSync)(_path().default.join(projectRoot, `android/app/src/${type}/java/**/${fileName}.@(java|kt)`))';
  const after = '(0, _tinyglobby().globSync)(`android/app/src/${type}/java/**/${fileName}.@(java|kt)`, { cwd: projectRoot, absolute: true })';
  const source = fs.readFileSync(file, 'utf8');
  if (version !== '58.0.12' || (!source.includes(before) && !source.includes(after))) {
    throw new Error('Review/remove the Expo Windows glob workaround for this config-plugins version');
  }
  if (source.includes(before)) fs.writeFileSync(file, source.replace(before, after));
}
