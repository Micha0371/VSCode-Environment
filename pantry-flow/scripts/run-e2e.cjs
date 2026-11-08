const { spawnSync, fork } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.verification/maestro');
fs.mkdirSync(out, { recursive: true });
const adb = process.env.ADB || 'adb';
const maestro = process.env.MAESTRO || 'maestro';
const run = (exe, args, options = {}) => {
  const result = spawnSync(exe, args, { cwd: root, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error(`${path.basename(exe)} exited ${result.status}`);
  return result;
};
const fixture = command => run(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/e2e-fixtures.ts', command]);
async function main() {
let failure;
const proxy = fork(path.join(__dirname, 'e2e-proxy.cjs'), { cwd: root, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
await new Promise((resolve, reject) => {
 const timer = setTimeout(() => { proxy.kill(); reject(Error('Local test proxy did not start')); }, 10000);
 proxy.once('message', () => { clearTimeout(timer); resolve(); });
 proxy.once('error', reject);
 proxy.once('exit', code => reject(Error(`Local test proxy exited ${code}`)));
});
try {
  // prepare resets only the three reserved fixture accounts, not the database.
  // Build before invocation using e2e:prepare + e2e:build, then fresh fixtures here.
  fixture('prepare');
  run(adb, ['install', '-r', '.verification/pantryflow-test.apk']);
  run(adb, ['logcat', '-c']);
  run(maestro, ['test', '--format', 'junit', '--output', '.verification/maestro/results.xml',
    '--debug-output', '.verification/maestro/debug', '.maestro/slice-1-1.yaml'], { shell: process.platform === 'win32' });
  fixture('verify');
} catch (error) { failure = error; }
finally {
  const logs = spawnSync(adb, ['logcat', '-d', '-v', 'threadtime'], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  fs.writeFileSync(path.join(out, 'android-logcat.txt'), logs.stdout || logs.stderr || 'No logs captured');
  // Matches the exact native asset failure observed in the prior device pass.
  if (/ExpoAsset\.downloadAsync.*(?:reject|error)|AppDirectories.*not found|Unable to load font|Unrecognized font family|Error loading font/i.test(logs.stdout || '')) {
    failure ||= Error('Native font/asset regression detected in Android logcat');
  }
  try { fixture('cleanup'); } catch (error) { failure ||= error; }
  proxy.kill();
}
if (failure) { console.error(failure.message); process.exitCode = 1; }

}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
