'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ejs = require('ejs');

const root = path.resolve(__dirname, '../../../..');
const addViewPath = path.join(root,
    'views/companies/genikastoixeia/partials/add/cardBodies/diafora.ejs');
const editViewPath = path.join(root,
    'views/companies/genikastoixeia/partials/edit/cardBodies/diafora.ejs');
const toggleSource = fs.readFileSync(path.join(root, 'public/js/common/toggleLabel.js'), 'utf8');
const fieldDefaults = Object.freeze({
    poly_mikro_diastima_kartas_eos_lepta: 5,
    mikro_diastima_kartas_eos_lepta: 60,
    mikro_diastima_kartas_max_pososto_programmatos: 25,
    mikro_diastima_kartas_elaxistos_xronos_pou_leipei_apo_programma_se_lepta: 60
});
const checkboxId = 'elegxos_ypopta_mikron_diastimaton_kartas';
const labelId = `label-${checkboxId}`;

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tagWithId(html, tagName, id) {
    const match = html.match(new RegExp(`<${tagName}\\b[^>]*\\bid="${escapeRegExp(id)}"[^>]*>`, 'i'));
    assert.ok(match, `missing ${tagName}#${id}`);
    return match[0];
}

function assertRenderedState(html, { enabled, values }) {
    const checkbox = tagWithId(html, 'input', checkboxId);
    assert.equal(/\bchecked\b/i.test(checkbox), enabled);
    assert.match(html, new RegExp(
        `<label\\b[^>]*\\bid="${labelId}"[^>]*>\\s*${enabled ? 'ΝΑΙ' : 'ΟΧΙ'}\\s*</label>`
    ));
    for (const [fieldId, value] of Object.entries(values)) {
        const input = tagWithId(html, 'input', fieldId);
        assert.match(input, new RegExp(`\\bvalue="${value}"`));
        assert.equal(/\bdisabled\b/i.test(input), !enabled, fieldId);
    }
}

function createTogglePage({ enabled, values }) {
    let readyHandler;
    const changeHandlers = new Map();
    const elements = {
        [checkboxId]: {
            checked: enabled,
            addEventListener(type, handler) {
                if (type === 'change') changeHandlers.set(checkboxId, handler);
            }
        },
        [labelId]: { textContent: enabled ? 'ΝΑΙ' : 'ΟΧΙ' }
    };
    for (const [fieldId, value] of Object.entries(values)) {
        elements[fieldId] = { value: String(value), disabled: !enabled };
    }
    const document = {
        addEventListener(type, handler) {
            if (type === 'DOMContentLoaded') readyHandler = handler;
        },
        getElementById(id) { return elements[id] || null; }
    };
    vm.runInNewContext(toggleSource, { document, Event }, { filename: 'toggleLabel.js' });
    readyHandler();
    return {
        elements,
        toggle(checked) {
            elements[checkboxId].checked = checked;
            changeHandlers.get(checkboxId)();
        }
    };
}

function response() {
    return {
        status: 200,
        ok: true,
        redirected: false,
        url: '',
        headers: { get: () => 'application/json' },
        async json() { return { success: true, redirectUrl: '/companies/genikastoixeia' }; },
        async text() { return ''; }
    };
}

async function serializeWithPageScript(scriptName, { enabled, values }) {
    const source = fs.readFileSync(path.join(__dirname, scriptName), 'utf8');
    let readyHandler;
    let submitHandler;
    let submittedPayload;
    const fields = [
        { tagName: 'INPUT', type: 'text', name: 'eponymia', value: 'ΔΟΚΙΜΗ ΑΕ', files: [] },
        { tagName: 'INPUT', type: 'text', name: 'afm', value: '123456789', files: [] },
        { tagName: 'INPUT', type: 'text', name: 'companyTeam', value: 'BLG', files: [] },
        { tagName: 'SELECT', name: 'selectedUsers', multiple: true,
            selectedOptions: [{ value: '507f1f77bcf86cd799439011' }] },
        { tagName: 'INPUT', type: 'checkbox', name: checkboxId, checked: enabled, files: [] },
        ...Object.entries(values).map(([name, value]) => ({
            tagName: 'INPUT', type: 'number', name, value: String(value),
            disabled: !enabled, files: []
        }))
    ];
    const document = {
        addEventListener(type, handler) {
            if (type === 'DOMContentLoaded') readyHandler = handler;
        },
        querySelector(selector) {
            if (selector === 'meta[name="csrf-token"]') {
                return { content: 'token', getAttribute: () => 'token' };
            }
            if (selector === 'input[name="_csrf"]') return { value: 'token' };
            return null;
        },
        querySelectorAll(selector) {
            if (selector === '.card-body') return [{ querySelectorAll: () => fields }];
            if (selector === '.submitButton') return [{
                addEventListener(type, handler) { if (type === 'click') submitHandler = handler; }
            }];
            return [];
        },
        getElementById(id) {
            return id === 'companyId' ? { value: '507f191e810c19729de860ea' } : null;
        }
    };
    const context = {
        document,
        Headers,
        URL,
        console,
        location: { origin: 'http://localhost', href: '' },
        fetch: async (_url, options) => {
            submittedPayload = JSON.parse(options.body);
            return response();
        },
        Swal: { fire: () => Promise.resolve({}) }
    };
    context.window = context;
    context.window.getCSRFToken = () => 'token';
    vm.runInNewContext(source, context, { filename: scriptName });
    readyHandler();
    await submitHandler({ preventDefault() {}, stopPropagation() {} });
    return submittedPayload;
}

test('ADD and EDIT render the exact initial suspicious-short policy states', () => {
    const addHtml = ejs.render(fs.readFileSync(addViewPath, 'utf8'));
    assertRenderedState(addHtml, {
        enabled: false,
        values: Object.fromEntries(Object.keys(fieldDefaults).map((field) => [field, 0]))
    });

    const disabledEditHtml = ejs.render(fs.readFileSync(editViewPath, 'utf8'), {
        company: { [checkboxId]: false }, nonce: 'test'
    });
    assertRenderedState(disabledEditHtml, {
        enabled: false,
        values: Object.fromEntries(Object.keys(fieldDefaults).map((field) => [field, 0]))
    });

    const defaultEditHtml = ejs.render(fs.readFileSync(editViewPath, 'utf8'), {
        company: { [checkboxId]: true }, nonce: 'test'
    });
    assertRenderedState(defaultEditHtml, { enabled: true, values: fieldDefaults });

    const customValues = {
        poly_mikro_diastima_kartas_eos_lepta: 3,
        mikro_diastima_kartas_eos_lepta: 45,
        mikro_diastima_kartas_max_pososto_programmatos: 20,
        mikro_diastima_kartas_elaxistos_xronos_pou_leipei_apo_programma_se_lepta: 75
    };
    const customEditHtml = ejs.render(fs.readFileSync(editViewPath, 'utf8'), {
        company: { [checkboxId]: true, ...customValues }, nonce: 'test'
    });
    assertRenderedState(customEditHtml, { enabled: true, values: customValues });
});

test('checkbox toggle updates ΝΑΙ/ΟΧΙ, enabled state and policy values', () => {
    const zeros = Object.fromEntries(Object.keys(fieldDefaults).map((field) => [field, 0]));
    const page = createTogglePage({ enabled: false, values: zeros });
    assert.equal(page.elements[labelId].textContent, 'ΟΧΙ');
    for (const fieldId of Object.keys(fieldDefaults)) {
        assert.equal(page.elements[fieldId].disabled, true);
        assert.equal(page.elements[fieldId].value, '0');
    }

    page.toggle(true);
    assert.equal(page.elements[labelId].textContent, 'ΝΑΙ');
    for (const [fieldId, value] of Object.entries(fieldDefaults)) {
        assert.equal(page.elements[fieldId].disabled, false);
        assert.equal(page.elements[fieldId].value, String(value));
    }

    page.toggle(false);
    assert.equal(page.elements[labelId].textContent, 'ΟΧΙ');
    for (const fieldId of Object.keys(fieldDefaults)) {
        assert.equal(page.elements[fieldId].disabled, true);
        assert.equal(page.elements[fieldId].value, '0');
    }
});

test('initial enabled EDIT state preserves persisted custom policy values', () => {
    const customValues = {
        poly_mikro_diastima_kartas_eos_lepta: 3,
        mikro_diastima_kartas_eos_lepta: 45,
        mikro_diastima_kartas_max_pososto_programmatos: 20,
        mikro_diastima_kartas_elaxistos_xronos_pou_leipei_apo_programma_se_lepta: 75
    };
    const page = createTogglePage({ enabled: true, values: customValues });
    assert.equal(page.elements[labelId].textContent, 'ΝΑΙ');
    for (const [fieldId, value] of Object.entries(customValues)) {
        assert.equal(page.elements[fieldId].disabled, false);
        assert.equal(page.elements[fieldId].value, String(value));
    }
});

test('ADD and EDIT serializers include disabled zeros and enabled visible values', async () => {
    const zeros = Object.fromEntries(Object.keys(fieldDefaults).map((field) => [field, 0]));
    const customValues = {
        poly_mikro_diastima_kartas_eos_lepta: 3,
        mikro_diastima_kartas_eos_lepta: 45,
        mikro_diastima_kartas_max_pososto_programmatos: 20,
        mikro_diastima_kartas_elaxistos_xronos_pou_leipei_apo_programma_se_lepta: 75
    };
    for (const scriptName of ['getFieldValues.js', 'putFieldValues_Company.js']) {
        const offPayload = await serializeWithPageScript(scriptName, {
            enabled: false, values: zeros
        });
        assert.equal(offPayload[checkboxId], false);
        for (const fieldId of Object.keys(fieldDefaults)) assert.equal(offPayload[fieldId], '0');

        const onPayload = await serializeWithPageScript(scriptName, {
            enabled: true, values: customValues
        });
        assert.equal(onPayload[checkboxId], true);
        for (const [fieldId, value] of Object.entries(customValues)) {
            assert.equal(onPayload[fieldId], String(value));
        }
    }
});

test('ADD and EDIT place a trailing divider after the suspicious-short settings block', () => {
    for (const [viewPath, locals] of [
        [addViewPath, {}],
        [editViewPath, { company: { [checkboxId]: false }, nonce: 'test' }]
    ]) {
        const html = ejs.render(fs.readFileSync(viewPath, 'utf8'), locals);
        const finalFieldIndex = html.indexOf(
            'id="mikro_diastima_kartas_elaxistos_xronos_pou_leipei_apo_programma_se_lepta"'
        );
        const nextSectionIndex = html.indexOf('for="tropos_ypologismoy_pragmatikoy_oromisthioy"');
        assert.ok(finalFieldIndex >= 0 && nextSectionIndex > finalFieldIndex);
        assert.match(html.slice(finalFieldIndex, nextSectionIndex), /<hr\s*\/>/);
    }
});
