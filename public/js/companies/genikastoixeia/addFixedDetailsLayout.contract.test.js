'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..', '..', '..');
const addView = fs.readFileSync(
    path.join(root, 'views/companies/genikastoixeia/add.ejs'),
    'utf8'
);
const fixedDetailsBody = fs.readFileSync(
    path.join(
        root,
        'views/companies/genikastoixeia/partials/add/cardBodies/statheraStoixeia.ejs'
    ),
    'utf8'
);
const layoutScript = fs.readFileSync(path.join(root, 'public/js/common/formLayout.js'), 'utf8');
const mainLayout = fs.readFileSync(path.join(root, 'views/layouts/main.ejs'), 'utf8');
const stylesheet = fs.readFileSync(path.join(root, 'public/css/main.css'), 'utf8');

const firstSectionStart = addView.indexOf('data-section="Σταθερά Στοιχεία"');
const secondSectionStart = addView.indexOf('data-section="Δραστηριότητες"');
const firstSection = addView.slice(firstSectionStart, secondSectionStart);
const remainingSections = addView.slice(secondSectionStart);

assert.ok(firstSectionStart >= 0);
assert.ok(secondSectionStart > firstSectionStart);
assert.strictEqual((addView.match(/id="companyAddFixedDetailsCard"/g) || []).length, 1);
assert.match(firstSection, /id="companyAddFixedDetailsCard"/);
assert.doesNotMatch(remainingSections, /companyAddFixedDetailsCard/);
assert.doesNotMatch(addView, /script\('companies\/genikastoixeia\/addFixedDetailsLayout'\)/);
assert.match(mainLayout, /<main\b[^>]*class="[^"]*\bpayroll-form-layout\b/);
assert.match(mainLayout, /script\('common\/formLayout'\)/);
assert.match(addView, /class="[^"]*\bcompanies-management-page\b/);
assert.match(firstSection, /id="companyAddFixedDetailsCard"[^>]*class="[^"]*\bcompanies-management-card\b/);

assert.match(
    fixedDetailsBody,
    /class="card-body overflow-auto flex-grow-1 w-100 bg-white"[^>]*style="min-height: 0;"/
);

const cardRule = stylesheet.match(/\.payroll-form-layout \.companies-management-page \.companies-management-card\s*\{([^}]+)\}/);
assert.ok(cardRule, 'Company cards must consume the common height and alignment rules');
assert.match(cardRule[1], /height:\s*var\(--payroll-card-space, auto\) !important;/);
assert.match(cardRule[1], /max-height:\s*var\(--payroll-card-space, none\) !important;/);
assert.match(cardRule[1], /width:\s*100%;/);
assert.match(cardRule[1], /margin:\s*0 !important;/);
assert.doesNotMatch(cardRule[1], /position\s*:\s*(?:fixed|sticky)/);
assert.match(stylesheet, /\.companies-management-card > :is\(\.card-header, \.card-footer\)\s*\{\s*flex:\s*0 0 auto;/);
assert.match(stylesheet, /\.companies-management-card > \.card-body\s*\{[^}]*min-height:\s*0;[^}]*overflow:\s*auto !important;/);
assert.doesNotMatch(firstSection, /height-vh-80/);

// Execute the real shared script with geometry only; no browser, server or database.
const style = () => ({ values: new Map(), setProperty(name, value) { this.values.set(name, value); } });
const mainEvents = new Map();
const windowEvents = new Map();
const frames = new Map();
const observed = new Set();
let frameId = 0;
let footerTop = 1000;
let cardTop = 200;
let visible = true;
let onResizeObserved;
const card = {
    style: style(), classList: { add(name) { assert.equal(name, 'payroll-scroll-card'); } },
    closest: () => null,
    getClientRects: () => visible ? [{}] : [],
    getBoundingClientRect: () => ({ top: cardTop }),
    matches: selector => selector.includes('.companies-management-page .companies-management-card'),
    querySelector: () => null
};
const cardFooter = {};
const companyPage = { querySelector: selector => selector === '.card-footer' ? cardFooter : null };
const main = {
    style: style(), scrollTop: 0,
    getBoundingClientRect: () => ({ top: 100, bottom: 900 }),
    querySelectorAll: selector => selector === '.card:has(.card-body):has(.card-footer)' ? [card] : [],
    querySelector: selector => selector === ':scope > .companies-management-page' ? companyPage : null,
    addEventListener: (name, callback) => mainEvents.set(name, callback)
};
const footer = { getBoundingClientRect: () => ({ top: footerTop }) };
vm.runInNewContext(layoutScript, {
    document: {
        readyState: 'complete', documentElement: { style: style() },
        querySelector: selector => selector === 'main.payroll-form-layout' ? main : selector === '.footer' ? footer : null
    },
    window: { addEventListener: (name, callback) => windowEvents.set(name, callback) },
    innerHeight: 1080,
    requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class {
        constructor(callback) { onResizeObserved = callback; }
        observe(element) { assert.ok(element); observed.add(element); }
    },
    MutationObserver: class { observe() {} }
}, { filename: 'formLayout.js' });
function flushFrame() {
    assert.equal(frames.size, 1, 'Height updates must share one scheduled frame');
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback());
}
flushFrame();
assert.equal(main.style.values.get('--payroll-main-top'), '100px');
assert.equal(card.style.values.get('--payroll-card-space'), '766px'); // 30px shadow + 4px gap
assert.ok(observed.has(main) && observed.has(footer) && observed.has(cardFooter));
footerTop = 800;
windowEvents.get('resize')();
windowEvents.get('resize')();
flushFrame();
assert.equal(card.style.values.get('--payroll-card-space'), '566px');
footerTop = 750;
onResizeObserved();
flushFrame();
assert.equal(card.style.values.get('--payroll-card-space'), '516px');
visible = false;
cardTop = 250;
mainEvents.get('click')({ target: { closest: () => true } });
flushFrame();
assert.equal(card.style.values.get('--payroll-card-space'), '516px', 'Hidden tabs must not be measured');
visible = true;
mainEvents.get('click')({ target: { closest: () => true } });
flushFrame();
assert.equal(card.style.values.get('--payroll-card-space'), '466px', 'Opening a tab must recalculate its height');
footerTop = 180;
windowEvents.get('resize')();
flushFrame();
assert.equal(card.style.values.get('--payroll-card-space'), '0px', 'Available height must never be negative');

console.log('PASS New Company first-tab dynamic-height layout contract');
