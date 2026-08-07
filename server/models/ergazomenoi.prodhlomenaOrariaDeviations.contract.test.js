const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, 'ergazomenoi.js'), 'utf8');
const schemaStart = source.indexOf('const ProdhlomenaOrariaDeviationsSchema = new Schema(');
const schemaEnd = source.indexOf('ProdhlomenaOrariaDeviationsSchema.index(', schemaStart);
const schemaSource = source.slice(schemaStart, schemaEnd);

test('deviation schema keeps optional diagnostic metadata without indexes or backfill defaults', () => {
    assert.ok(schemaStart >= 0 && schemaEnd > schemaStart);
    assert.ok(schemaSource.includes('status: { type: String, trim: true }'));
    assert.ok(schemaSource.includes('reasons: { type: [String], default: undefined }'));
    assert.ok(!schemaSource.includes('status: { type: String, required: true'));
    assert.ok(!schemaSource.includes('status: { type: String, default:'));
    assert.ok(!schemaSource.includes('reasons: { type: [String], default: []'));
});

test('diagnostic metadata does not participate in a deviation index', () => {
    const indexSection = source.slice(schemaEnd, source.indexOf(
        "const ProdhlomenaOrariaDeviationsModel = model(",
        schemaEnd
    ));
    assert.ok(!indexSection.includes('status:'));
    assert.ok(!indexSection.includes('reasons:'));
});
