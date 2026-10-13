import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('src/lib/site-protection.ts', 'utf8').split('const hosts =')[0].replace(/^import .*;\n/, '').replace('export function', 'function');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
function run(host, protocol = 'https:', development = false, readyState = 'complete') {
  const listeners = {};
  class Element {
    constructor(tag, editable = false) { this.tag = tag; this.editable = editable; this.style = {}; this.children = []; }
    closest(selector) { return selector.includes('input') ? this.editable : ['img', 'picture', 'video'].includes(this.tag); }
    append(...nodes) { this.children.push(...nodes); }
    appendChild(node) { this.children.push(node); }
    setAttribute(key, value) { this[key] = value; }
  }
  const document = { readyState, head: new Element('head'), body: new Element('body'), createElement: tag => new Element(tag), addEventListener: (name, fn) => { listeners[name] = fn; } };
  const context = vm.createContext({ document, Element, location: { hostname: host, protocol } });
  vm.runInContext(compiled + `;installProtection(['quiemadolivrepro.vercel.app'],'data:image/webp;base64,test',${development});`, context);
  function event(name, target = new Element('div'), rest = {}) {
    const e = { target, prevented: false, preventDefault() { this.prevented = true; }, stopPropagation() {}, ...rest };
    listeners[name](e); return e;
  }
  return { document, listeners, Element, event };
}
const live = run('quiemadolivrepro.vercel.app');
assert.equal(live.document.body.children.length, 0);
assert.equal(live.event('contextmenu').prevented, true);
assert.equal(live.event('contextmenu', new live.Element('input', true)).prevented, false);
assert.equal(live.event('dragstart', new live.Element('img')).prevented, true);
for (const key of ['s', 'u']) assert.equal(live.event('keydown', undefined, { key, ctrlKey: true }).prevented, true);
assert.equal(live.event('keydown', undefined, { key: 'F12' }).prevented, true);
assert.equal(live.event('keydown', undefined, { key: 'I', metaKey: true, shiftKey: true }).prevented, true);
for (const key of ['c', 'v', 'a']) assert.equal(live.event('keydown', undefined, { key, ctrlKey: true }).prevented, false);
for (const [host, protocol] of [['clone.example', 'https:'], ['', 'file:'], ['quiemadolivrepro.vercel.app.clone.example', 'https:']]) {
  const copy = run(host, protocol);
  assert.equal(copy.document.body.children[0]['data-copy-blocked'], 'true');
  assert.match(copy.document.body.children[0].children[0].src, /^data:image/);
}
const loading = run('clone.example', 'https:', false, 'loading');
assert.equal(loading.document.body.children.length, 0);
loading.listeners.DOMContentLoaded();
assert.equal(loading.document.body.children.length, 1);
assert.equal(run('localhost', 'http:', true).document.body.children.length, 0);
assert.equal(run('localhost', 'http:', false).document.body.children.length, 1);
console.log('Site protection: authorized hosts, exported copies, images and checkout shortcuts passed.');

const all = fs.readFileSync('src/lib/site-protection.ts', 'utf8');
const navigation = all.slice(all.indexOf('function installNavigationGuard'), all.indexOf('export const DOMAIN_NAVIGATION_SCRIPT'));
const navigationJs = ts.transpileModule(navigation, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
for (const [host, expected] of [['quiemadolivrepro.vercel.app', false], ['clone.example', true]]) {
  const listeners = {};
  const styles = [];
  const fallback = { style: { setProperty: (...args) => styles.push(args) } };
  const document = { readyState: 'complete', querySelector: () => fallback, createElement: () => ({}), head: { appendChild() {} }, addEventListener: (name, fn) => { listeners[name] = fn; } };
  const context = vm.createContext({ document, location: { hostname: host, protocol: 'https:' }, window: { addEventListener() {} } });
  vm.runInContext(navigationJs + ";installNavigationGuard(['quiemadolivrepro.vercel.app'],false);", context);
  const event = { prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
  listeners.click(event);
  assert.equal(event.prevented, expected);
  assert.equal(event.stopped, expected);
  assert.equal(styles.length > 0, expected);
}
const homepage = fs.readFileSync('src/routes/index.tsx', 'utf8');
assert.match(homepage, /SITE_PROTECTION_SCRIPT/);
assert.match(homepage, /PROTECTION_FALLBACK_HTML/);
assert.match(homepage, /DOMAIN_NAVIGATION_SCRIPT/);
console.log('Independent navigation guard: authorized checkout allowed; copied-domain clicks blocked.');
