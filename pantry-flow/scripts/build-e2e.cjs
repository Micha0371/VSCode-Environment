// Isolated build workspace: production app.json/source files are never modified.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const work = path.join(root, '.verification/e2e-app');
try {
const publicEnv = JSON.parse(fs.readFileSync(path.join(root, '.verification/e2e-env.json'), 'utf8'));
if (publicEnv.EXPO_PUBLIC_SUPABASE_URL !== 'http://10.0.2.2:54329') throw Error('Only the Android emulator local Supabase endpoint is allowed');
fs.mkdirSync(work, { recursive: true });
for (const name of ['app', 'components', 'hooks', 'lib']) {
  const target = path.resolve(work, name);
  if (!target.startsWith(path.resolve(root, '.verification') + path.sep)) throw Error('Unsafe generated-source target');
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(path.join(root, name), target, { recursive: true, force: true });
}
for (const name of ['package.json', 'babel.config.js', 'tsconfig.json']) fs.copyFileSync(path.join(root, name), path.join(work, name));
const config = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
config.expo.name = 'PantryFlow Tests';
config.expo.scheme = 'pantryflowtest';
config.expo.android.package = 'com.pantryflow.test';
// Local-only HTTP transport, confined to the separate test APK.
config.expo.android.usesCleartextTraffic = true;
fs.writeFileSync(path.join(work, 'app.json'), JSON.stringify(config));
if (!fs.existsSync(path.join(work, 'node_modules'))) fs.symlinkSync(path.join(root, 'node_modules'), path.join(work, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
const env = { ...process.env, ...publicEnv, EXPO_NO_DOTENV: '1', CI: '1' };
execFileSync(process.execPath, [path.join(root, 'node_modules/expo/bin/cli'), 'prebuild', '--platform', 'android', '--no-install'], { cwd: work, env, stdio: 'inherit' });
const linked = JSON.parse(execFileSync(process.execPath, [path.join(root, 'node_modules/expo-modules-autolinking/bin/expo-modules-autolinking'),
  'resolve', '--platform', 'android', '--json'], { cwd: work, env, encoding: 'utf8' }));
if (!linked.modules?.some(module => module.packageName === 'expo-file-system')) {
  throw Error('Native regression: expo-file-system is absent from Android autolinking; fonts/assets will fail');
}
const manifest = path.join(work, 'android/app/src/main/AndroidManifest.xml');
let xml = fs.readFileSync(manifest, 'utf8');
xml = xml.replace(/\sandroid:usesCleartextTraffic="[^"]*"/g, '').replace('<application ', '<application android:usesCleartextTraffic="true" ');
fs.writeFileSync(manifest, xml);
if (process.platform === 'win32') {
  const buildFile = path.join(work, 'android/app/build.gradle');
  const staging = path.join(root, '.verification/e2e-cxx').replaceAll('\\', '/');
  const content = fs.readFileSync(buildFile, 'utf8').replace('android {',
    `android {\n    externalNativeBuild { cmake { buildStagingDirectory file('${staging}') } }\n    defaultConfig { externalNativeBuild { cmake { arguments '-DCMAKE_OBJECT_PATH_MAX=250' } } }`);
  fs.writeFileSync(buildFile, content);
}
// Release JS bundle/lifecycle with a disposable debug-signed test package.
const gradle = process.platform === 'win32' ? path.join(work, 'android/gradlew.bat') : './gradlew';
execFileSync(gradle, ['assembleRelease', '-PreactNativeArchitectures=x86_64', '--max-workers=2', '--no-daemon'], {
  cwd: path.join(work, 'android'), env, stdio: 'inherit', shell: process.platform === 'win32',
});
fs.copyFileSync(path.join(work, 'android/app/build/outputs/apk/release/app-release.apk'), path.join(root, '.verification/pantryflow-test.apk'));

} catch (error) {
  try { execFileSync(process.execPath, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), path.join(root, 'scripts/e2e-fixtures.ts'), 'cleanup'], { cwd: root, stdio: 'inherit' }); }
  catch (cleanupError) { console.error('Local fixture cleanup also failed:', cleanupError.message); }
  throw error;
}
