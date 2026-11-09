const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { renamePackageOnDiskForType } = require('@expo/config-plugins/build/android/Package');

test('Expo prebuild refactors debug package files from a Windows-compatible glob', async () => {
  const parent = path.resolve(__dirname, '../.verification');
  fs.mkdirSync(parent, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(parent, 'native-package-'));
  const originalCwd = process.cwd();
  try {
    const source = path.join(fixture, 'android/app/src/debug/java/com/old');
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(source, 'Debug.kt'), 'package com.old\nclass Debug\n');
    process.chdir(fixture);
    await renamePackageOnDiskForType({ projectRoot: fixture, type: 'debug', packageName: 'com.pantryflow.test' });
    const target = path.join(fixture, 'android/app/src/debug/java/com/pantryflow/test/Debug.kt');
    assert.equal(fs.readFileSync(target, 'utf8'), 'package com.pantryflow.test\nclass Debug\n');
    assert.equal(fs.existsSync(path.join(source, 'Debug.kt')), false);
  } finally {
    process.chdir(originalCwd);
    assert.equal(path.dirname(fixture), parent);
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
