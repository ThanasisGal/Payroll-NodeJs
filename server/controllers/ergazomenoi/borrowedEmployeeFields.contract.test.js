const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const vm = require('vm');

const { ErgazomenoiModel } = require('../../models/ergazomenoi');

const projectRoot = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

const controller = read('server/controllers/ergazomenoi/ergazomenoiController.js');
const toggleScript = read('public/js/common/toggleLabelErgazomenon.js');
const afmScript = read('public/js/common/checkAfm.js');
const addView = read(
    'views/ergazomenoi/ergazomenoi/partials/add/cardBodies/section1/accordion/stoixeiaProslhpshs.ejs'
);
const editView = read(
    'views/ergazomenoi/ergazomenoi/partials/edit/cardBodies/section1/accordion/stoixeiaProslhpshs.ejs'
);

const fields = [
    ['afm_daneizontos_ergodoth', 'String', ''],
    ['afm_daneizomenoy_ergodoth', 'String', ''],
    ['typos_ergodoth_daneismoy', 'Boolean', false],
    ['kodikos_ergazomenoy_alloy_ergodoth', 'String', '']
];

function testSchemaFieldsAndDefaults() {
    fields.forEach(([name, instance, expectedDefault]) => {
        const schemaPath = ErgazomenoiModel.schema.path(name);
        assert.ok(schemaPath, `missing schema field ${name}`);
        assert.strictEqual(schemaPath.instance, instance, `${name} type`);
        assert.strictEqual(schemaPath.getDefault(), expectedDefault, `${name} default`);
    });
}

function testCreateAndUpdatePersistencePolicy() {
    const occurrences = (needle) => controller.split(needle).length - 1;

    assert.strictEqual(
        occurrences('const aforaDaneismoErgazomenoy = formData.afora_daneismo_ergazomenoy === true;'),
        2,
        'create and update must independently derive the borrowing flag'
    );

    fields.forEach(([name]) => {
        assert.strictEqual(
            occurrences(`${name}: aforaDaneismoErgazomenoy`),
            2,
            `${name} must be persisted by create and update`
        );
    });

    assert.strictEqual(
        occurrences("? String(formData.afm_daneizontos_ergodoth || '').trim() : ''"),
        2
    );
    assert.strictEqual(
        occurrences("? String(formData.afm_daneizomenoy_ergodoth || '').trim() : ''"),
        2
    );
    assert.strictEqual(
        occurrences('? formData.typos_ergodoth_daneismoy === true : false'),
        2
    );
    assert.strictEqual(
        occurrences("? String(formData.kodikos_ergazomenoy_alloy_ergodoth || '').trim() : ''"),
        2
    );
}

function testFormsContainBorrowingFields() {
    [addView, editView].forEach((view, index) => {
        fields.forEach(([name]) => {
            assert.ok(view.includes(`id="${name}"`), `form ${index + 1} missing ${name}`);
            assert.ok(view.includes(`name="${name}"`), `form ${index + 1} missing name ${name}`);
        });
        assert.ok(view.includes('id="daneismos_afm_row"'));
        assert.ok(view.includes('id="daneismos_ergodoths_row"'));
        assert.ok(view.indexOf('id="hmnia_lhxhs_daneismoy"') < view.indexOf('id="daneismos_afm_row"'));
    });

    assert.doesNotThrow(() => ejs.compile(addView, { filename: 'add-stoixeiaProslhpshs.ejs' }));
    assert.doesNotThrow(() => ejs.compile(editView, { filename: 'edit-stoixeiaProslhpshs.ejs' }));
    assert.ok(editView.includes("safe('typos_ergodoth_daneismoy') ? 'checked' : ''"));
}

function testFrontendToggleAndAfmHandlers() {
    assert.ok(toggleScript.includes("'typos_ergodoth_daneismoy'"));
    assert.ok(toggleScript.includes("case 'afora_daneismo_ergazomenoy':"));
    assert.ok(toggleScript.includes("classList.toggle('d-none', !isChecked)"));
    assert.ok(toggleScript.includes('typosErgodothDaneismoy.checked = false'));
    assert.ok(toggleScript.includes("case 'typos_ergodoth_daneismoy':"));
    assert.ok(toggleScript.includes("'ΔΑΝΕΙΖΟΜΕΝΟΣ' : 'ΔΑΝΕΙΖΩΝ'"));
    assert.ok(toggleScript.includes("'Κωδ. Εργ/νου στον Δανείζοντα Εργοδότη'"));
    assert.ok(toggleScript.includes("'Κωδ. Εργ/νου στον Δανειζόμενο Εργοδότη'"));
    assert.ok(afmScript.includes('afm_daneizontos_ergodoth: noOpHandler'));
    assert.ok(afmScript.includes('afm_daneizomenoy_ergodoth: noOpHandler'));
}

function testFrontendToggleBehavior() {
    const functionStart = toggleScript.indexOf('function toggleCheckboxState');
    const functionEnd = toggleScript.indexOf('function setFieldsDisabled', functionStart);
    const elements = new Map();
    const element = (id) => {
        if (!elements.has(id)) {
            const classes = new Set(['d-none']);
            elements.set(id, {
                checked: true,
                textContent: '',
                classList: {
                    toggle(name, force) {
                        force ? classes.add(name) : classes.delete(name);
                    },
                    contains(name) {
                        return classes.has(name);
                    }
                }
            });
        }
        return elements.get(id);
    };
    const context = {
        document: { getElementById: element },
        setFieldsDisabled() {}
    };

    vm.runInNewContext(toggleScript.slice(functionStart, functionEnd), context);
    context.toggleCheckboxState('afora_daneismo_ergazomenoy', true);
    assert.strictEqual(element('daneismos_afm_row').classList.contains('d-none'), false);
    assert.strictEqual(element('daneismos_ergodoths_row').classList.contains('d-none'), false);

    context.toggleCheckboxState('typos_ergodoth_daneismoy', true);
    assert.strictEqual(element('label-typos_ergodoth_daneismoy').textContent, 'ΔΑΝΕΙΖΟΜΕΝΟΣ');
    assert.strictEqual(
        element('kodikos_ergazomenoy_alloy_ergodoth_label').textContent,
        'Κωδ. Εργ/νου στον Δανείζοντα Εργοδότη'
    );

    context.toggleCheckboxState('afora_daneismo_ergazomenoy', false);
    assert.strictEqual(element('daneismos_afm_row').classList.contains('d-none'), true);
    assert.strictEqual(element('daneismos_ergodoths_row').classList.contains('d-none'), true);
    assert.strictEqual(element('typos_ergodoth_daneismoy').checked, false);
    assert.strictEqual(element('label-typos_ergodoth_daneismoy').textContent, 'ΔΑΝΕΙΖΩΝ');
}

function run() {
    testSchemaFieldsAndDefaults();
    testCreateAndUpdatePersistencePolicy();
    testFormsContainBorrowingFields();
    testFrontendToggleAndAfmHandlers();
    testFrontendToggleBehavior();
    console.log('borrowed employee fields contract tests passed');
}

run();
