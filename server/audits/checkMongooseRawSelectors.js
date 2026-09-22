'use strict';

// Static guard for server-owned field-selector operators in Mongoose filters.
// It deliberately ignores aggregations, native collections, update documents and tests.
const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');
const root = path.resolve(__dirname, '../..');
const queryApis = new Set(['find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete',
    'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'countDocuments', 'exists', 'distinct']);
const skipParse = new Set([
    'server/controllers/Kinhseis/kinhseis/apodeixeis.js',
    'server/utils/dropdownHelper_old.js',
    'server/utils/formatNumber.js'
]);
const classified = new Map();
function key(node) { return node?.type === 'Identifier' ? node.name : node?.type === 'Literal' ? String(node.value) : ''; }
function member(node) { return node?.type === 'MemberExpression' ? `${member(node.object)}.${key(node.property)}` : key(node); }
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    return entry.name.endsWith('.js') && !/\.(test|spec)\.js$/.test(entry.name) ? [full] : [];
}); }
function walk(node, fn, ancestors = []) {
    if (!node || typeof node !== 'object' || !node.type) return;
    fn(node, ancestors);
    for (const [field, value] of Object.entries(node)) {
        if (field === 'loc' || field === 'start' || field === 'end') continue;
        if (Array.isArray(value)) value.forEach(child => walk(child, fn, [...ancestors, node]));
        else walk(value, fn, [...ancestors, node]);
    }
}
function inspect(node, file, scope, found, parentField = '') {
    if (!node) return;
    if (node.type === 'CallExpression' && member(node.callee) === 'mongoose.trusted') {
        if (!parentField) inspect(node.arguments[0], file, scope, found);
        return;
    }
    if (node.type === 'ArrayExpression') return node.elements.forEach(item => inspect(item, file, scope, found, parentField));
    if (node.type !== 'ObjectExpression') return;
    const properties = node.properties.filter(property => property.type === 'Property');
    const operatorKeys = properties.filter(property => key(property.key).startsWith('$'));
    if (parentField && operatorKeys.length) {
        for (const property of operatorKeys) {
            const id = `${file}:${scope}:${parentField}:${key(property.key)}`;
            if (!classified.has(id)) found.push({ id, operator: key(property.key) });
        }
        return;
    }
    for (const property of properties) {
        const name = key(property.key);
        inspect(property.value, file, scope, found, name.startsWith('$') ? '' : name);
    }
}
function auditSource(source, file) {
    const found = [];
    let ast;
    try { ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true }); }
    catch (error) { return skipParse.has(file) ? [] : [{ id: file, operator: `Parse failure: ${error.message}` }]; }
        walk(ast, (node, ancestors) => {
            if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') return;
            const api = key(node.callee.property);
            if (!queryApis.has(api) || /(^|\.)collection$/.test(member(node.callee.object))) return;
            const scope = [...ancestors].reverse().find(item => item.type === 'PropertyDefinition' || item.type === 'MethodDefinition');
            const scopeName = key(scope?.key) || 'module';
            const first = node.arguments[0];
            if (first?.type === 'ObjectExpression' || first?.type === 'CallExpression')
                inspect(first, file, scopeName, found);
            else if (first?.type === 'Identifier') {
                const declarations = [];
                const enclosing = [...ancestors].reverse().find(item => /Function/.test(item.type)) || ast;
                walk(enclosing, candidate => {
                    if (candidate.type === 'VariableDeclarator' && key(candidate.id) === first.name &&
                        candidate.start < node.start && ['ObjectExpression', 'CallExpression'].includes(candidate.init?.type)) declarations.push(candidate);
                });
                const assignments = [];
                walk(enclosing, candidate => {
                    if (candidate.type === 'AssignmentExpression' && key(candidate.left) === first.name &&
                        candidate.start < node.start && ['ObjectExpression', 'CallExpression'].includes(candidate.right?.type)) assignments.push(candidate);
                });
                const latestDeclaration = declarations.at(-1);
                const latestAssignment = assignments.at(-1);
                if (latestAssignment && (!latestDeclaration || latestAssignment.start > latestDeclaration.start))
                    inspect(latestAssignment.right, file, scopeName, found);
                else if (latestDeclaration) inspect(latestDeclaration.init, file, scopeName, found);
            }
        });
    return [...new Map(found.map(item => [item.id, item])).values()];
}
function audit() {
    const found = [];
    for (const absolute of [path.join(root, 'app.js'), ...files(path.join(root, 'server'))]) {
        const file = path.relative(root, absolute).replaceAll(path.sep, '/');
        found.push(...auditSource(fs.readFileSync(absolute, 'utf8'), file));
    }
    return [...new Map(found.map(item => [item.id, item])).values()];
}
if (require.main === module) {
    const found = audit();
    if (found.length) { for (const item of found) console.error(`${item.id} ${item.operator}`); process.exitCode = 1; }
    else console.log('No unclassified direct Mongoose field-selector operators.');
}
module.exports = { audit, auditSource };
