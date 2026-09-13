'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, 'main.css'), 'utf8');
const contract = css.match(
    /\.swal2-popup\.employment-review-swal-popup \.swal2-html-container,[\s\S]*?\n}/)?.[0] || '';
assert.match(contract,
    /\.swal2-popup\.employment-review-swal-popup \.employment-review-swal-html-container/);
assert.match(contract, /font-size:\s*0\.95rem !important/);
assert.doesNotMatch(contract, /font-size:\s*[^;]*vw/);
assert.doesNotMatch(css.match(
    /\.swal2-popup\.employment-review-swal-popup \.swal2-title[\s\S]*?\n}/)?.[0] || '',
    /font-size:\s*0\.95rem/);
const secondaryHover = css.match(
    /\.employment-review-action-secondary:hover,[\s\S]*?\n}/)?.[0] || '';
assert.match(secondaryHover, /\.employment-review-action-secondary:focus/);
assert.match(secondaryHover, /color:\s*#ffffff/);
assert.match(secondaryHover, /background:\s*#6c757d/);

console.log('employment-review Swal typography and action style contract tests passed');
