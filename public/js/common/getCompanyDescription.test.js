const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const sourcePath = path.join(__dirname, 'getCompanyDescription.js');
const source = fs.readFileSync(sourcePath, 'utf8');

test('company header keeps the complete company description', async () => {
    const expected = 'Εταιρεία : 0006   ΒΑΓΔΟΥΤΗ ΓΕΩΡΓΙΑ';
    const shortened = 'Εταιρεία : 0006   ΒΑΓΔΟΥΤΗ ΓΕΩΡΓΙ';
    let domContentLoadedHandler;
    let scheduledUpdate;
    let resolveUpdated;
    const updated = new Promise((resolve) => {
        resolveUpdated = resolve;
    });
    const selectedCompanyElement = {
        innerHTML: '',
        set textContent(value) {
            this.renderedText = value;
            resolveUpdated();
        }
    };

    const sandbox = {
        console,
        document: {
            addEventListener(eventName, handler) {
                if (eventName === 'DOMContentLoaded') domContentLoadedHandler = handler;
            },
            getElementById(id) {
                return id === 'selectedCompany' ? selectedCompanyElement : null;
            },
            querySelector() {
                return null;
            }
        },
        fetch: async () => ({
            ok: true,
            headers: { get: () => 'application/json; charset=utf-8' },
            text: async () => JSON.stringify({
                newCompanyDescription: '0006   ΒΑΓΔΟΥΤΗ ΓΕΩΡΓΙΑ'
            })
        }),
        setTimeout(handler) {
            scheduledUpdate = handler;
        }
    };

    vm.runInNewContext(source, sandbox, { filename: sourcePath });
    domContentLoadedHandler();
    scheduledUpdate();
    await updated;

    assert.equal(selectedCompanyElement.renderedText, expected);
    assert.notEqual(selectedCompanyElement.renderedText, shortened);
});
