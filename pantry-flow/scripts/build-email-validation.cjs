// Manual hosted-email acceptance only. The local CI builder stays local-only.
// Rebundle an already successful ARM64 test build with this project's PUBLIC key.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const work = path.join(root, '.verification/e2e-app');
const expectedRef = 'oiqteedkfwmcertgxqga';
if (process.argv[2] !== '--project-ref' || process.argv[3] !== expectedRef || process.argv.length !== 4) {
  throw new Error('Explicit intended project reference required');
}
if (fs.existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
assert.equal(url, `https://${expectedRef}.supabase.co`);
assert.ok(key, 'A public publishable/anon key is required');
assert.ok(!key.startsWith('sb_secret_'), 'Never bundle a secret key');
if (!key.startsWith('sb_publishable_')) {
  const payload = JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64url').toString());
  assert.equal(payload.role, 'anon', 'Never bundle an administrative key');
}
const config = JSON.parse(fs.readFileSync(path.join(work, 'app.json'), 'utf8'));
assert.equal(config.expo.android.package, 'com.pantryflow.test');
assert.equal(config.expo.scheme, 'pantryflowtest');
const packageFor = base => JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf8'));
assert.deepEqual(packageFor(work).dependencies, packageFor(root).dependencies, 'Rebuild the local test APK after dependency changes');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function snapshot(base, folder) {
  const result = {};
  for (const item of fs.readdirSync(path.join(base, folder), { withFileTypes: true })) {
    const relative = path.join(folder, item.name);
    if (item.isDirectory()) Object.assign(result, snapshot(base, relative));
    else if (item.isFile()) result[relative] = hash(path.join(base, relative));
    else throw new Error('Unexpected source symlink');
  }
  return result;
}
for (const folder of ['app', 'components', 'hooks', 'lib']) {
  assert.deepEqual(snapshot(work, folder), snapshot(root, folder), 'Rebuild the local test APK after source changes');
}
for (const file of ['babel.config.js', 'tsconfig.json']) assert.equal(hash(path.join(root, file)), hash(path.join(work, file)));
const release = path.join(work, 'android/app/build/outputs/apk/release/app-release.apk');
assert.equal(hash(release), hash(path.join(root, '.verification/pantryflow-test-arm64-v8a.apk')), 'A successful matching ARM64 local test build is required');
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('EXPO_PUBLIC_')));
Object.assign(env, { EXPO_NO_DOTENV: '1', CI: '1', EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: key });
const gradle = process.platform === 'win32' ? path.join(work, 'android/gradlew.bat') : './gradlew';
const options = { cwd: path.join(work, 'android'), env, stdio: 'inherit', shell: process.platform === 'win32' };
// Environment values are not Gradle task inputs, so explicitly refresh the JS bundle.
execFileSync(gradle, [':app:createBundleReleaseJsAndAssets', '--rerun-tasks', '--max-workers=2', '--no-daemon'], options);
execFileSync(gradle, [':app:assembleRelease', '-PreactNativeArchitectures=arm64-v8a', '--max-workers=2', '--no-daemon'], options);
fs.copyFileSync(release, path.join(root, '.verification/pantryflow-email-validation.apk'));
console.log('Built isolated hosted email-validation APK for the explicitly selected project. No hosted requests were made by this builder.');
