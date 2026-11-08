const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// React 19 requires test runners outside Jest to declare their act environment.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Compile the production TS/TSX unchanged. Only native/network boundaries are
// injected; React hooks and context execute with the real React renderer.
exports.load = (file, stubs = {}) => {
  const filename = path.resolve(__dirname, '..', file);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    if (name.startsWith('.')) return require(path.resolve(path.dirname(filename), name));
    return require(name);
  }, mod, mod.exports);
  return mod.exports;
};
exports.deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
