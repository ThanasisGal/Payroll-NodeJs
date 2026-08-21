const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, 'moveByEnter.js');
const source = fs.readFileSync(sourcePath, 'utf8');

function loadOnEnter() {
  const sandbox = {
    document: { addEventListener() {} },
    getComputedStyle() {
      return { display: 'block', visibility: 'visible', position: 'static' };
    }
  };
  vm.runInNewContext(`${source}\nthis.onEnterForTest = onEnter;`, sandbox, {
    filename: sourcePath
  });
  return sandbox.onEnterForTest;
}

function createFixture({ open, highlighted }) {
  let prevented = false;
  let stopped = false;
  let closed = false;
  let nextFocused = false;

  const next = {
    tagName: 'INPUT',
    type: 'text',
    offsetParent: {},
    matches: () => false,
    hasAttribute: () => false,
    getAttribute: () => null,
    classList: { contains: () => false },
    focus() { nextFocused = true; }
  };
  const select = {
    multiple: false,
    tomselect: {
      isOpen: open,
      activeOption: null,
      settings: { mode: 'single' },
      control_input: { value: '' },
      dropdown: {
        classList: { contains: () => false },
        querySelector: () => highlighted ? { dataset: { selectable: '' } } : null
      },
      close() { closed = true; }
    }
  };
  const wrapper = {
    offsetParent: {},
    classList: { contains: (name) => name === 'ts-wrapper' },
    previousElementSibling: {
      ...select,
      matches: (selector) => selector === 'select.tom-dropdown'
    },
    querySelector: () => null,
    closest: () => wrapper,
    contains: (node) => node === wrapper
  };
  const form = { querySelectorAll: () => [wrapper, next] };
  const target = {
    closest: (selector) => selector === 'form' ? form : selector === '.ts-wrapper' ? wrapper : null,
    matches: () => false
  };
  const event = {
    key: 'Enter',
    target,
    preventDefault() { prevented = true; },
    stopImmediatePropagation() { stopped = true; }
  };

  return {
    event,
    state: () => ({ prevented, stopped, closed, nextFocused })
  };
}

test('open single TomSelect with DOM-highlighted option leaves Enter to TomSelect', () => {
  const { event, state } = createFixture({ open: true, highlighted: true });

  loadOnEnter()(event);

  assert.deepEqual(state(), {
    prevented: false,
    stopped: false,
    closed: false,
    nextFocused: false
  });
});

test('closed single TomSelect keeps moving focus on Enter', () => {
  const { event, state } = createFixture({ open: false, highlighted: false });

  loadOnEnter()(event);

  assert.deepEqual(state(), {
    prevented: true,
    stopped: true,
    closed: true,
    nextFocused: true
  });
});
