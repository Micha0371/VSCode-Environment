const { spawnSync, fork } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.verification/maestro');
fs.mkdirSync(out, { recursive: true });
const adb = process.env.ADB || 'adb';
const maestro = process.env.MAESTRO || 'maestro';
// Maestro does not use ADB's ANDROID_SERIAL to select its own driver target.
const maestroDevice = process.env.ANDROID_SERIAL ? ['--device', process.env.ANDROID_SERIAL] : [];
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
try {
await new Promise((resolve, reject) => {
 const timer = setTimeout(() => { proxy.kill(); reject(Error('Local test proxy did not start')); }, 10000);
 proxy.once('message', () => { clearTimeout(timer); resolve(); });
 proxy.once('error', reject);
 proxy.once('exit', code => reject(Error(`Local test proxy exited ${code}`)));
});
  // prepare resets only the four reserved fixture accounts, not the database.
  // Build before invocation using e2e:prepare + e2e:build, then fresh fixtures here.
  fixture('prepare');
  run(adb, ['install', '-r', '.verification/pantryflow-test.apk']);
  run(adb, ['logcat', '-c']);
  run(maestro, [...maestroDevice, 'test', '--format', 'junit', '--output', '.verification/maestro/results.xml',
    '--debug-output', '.verification/maestro/debug', '.maestro/slice-1-1.yaml'], {
      shell: process.platform === 'win32',
      env: { ...process.env, MAESTRO_CLI_NO_ANALYTICS: '1', MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true' },
    });
  fixture('verify');
  const confirmationFlow = (file, callback, report = file) => run(maestro, [...maestroDevice, 'test', '--format', 'junit',
    '--output', `.verification/maestro/${report}.xml`, '--debug-output', `.verification/maestro/${report}`,
    `.maestro/${file}.yaml`], { shell: process.platform === 'win32',
    env: { ...process.env, MAESTRO_CLI_NO_ANALYTICS: '1', MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED: 'true',
      ...(callback ? { MAESTRO_CONFIRMATION_URL: callback } : {}) } });
  confirmationFlow('confirmation-register');
  fixture('confirmation-first');
  let state = JSON.parse(fs.readFileSync(path.join(root, '.verification/confirmation-state.json'), 'utf8'));
  confirmationFlow('confirmation-complete', state.confirmed, 'confirmation-first-complete');
  fixture('confirmation-reset');
  confirmationFlow('confirmation-register');
  fixture('confirmation-expired');
  state = JSON.parse(fs.readFileSync(path.join(root, '.verification/confirmation-state.json'), 'utf8'));
  confirmationFlow('confirmation-resend', state.expired);
  fixture('confirmation-resent');
  state = JSON.parse(fs.readFileSync(path.join(root, '.verification/confirmation-state.json'), 'utf8'));
  confirmationFlow('confirmation-complete', state.confirmed);
  fixture('confirmation-verify');
} catch (error) { failure = error; }
finally {
  const logs = spawnSync(adb, ['logcat', '-d', '-v', 'threadtime'], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (logs.error || logs.status !== 0) failure ||= Error('Android diagnostic log capture failed');
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
