'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const acorn = require('acorn');
const root = path.resolve(__dirname, '../..');

function files(dir, suffix) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) return files(file, suffix);
        return entry.name.endsWith(suffix) && !/\.test\.js$|\.min\.js$/.test(entry.name) ? [file] : [];
    });
}
function name(node) {
    if (!node) return '';
    if (node.type === 'Identifier') return node.name;
    if (node.type === 'Literal') return String(node.value);
    if (node.type === 'MemberExpression') return `${name(node.object)}.${name(node.property)}`;
    return '';
}
function property(object, key) {
    return object?.type === 'ObjectExpression'
        ? object.properties.find(item => item.type === 'Property' && name(item.key) === key)?.value
        : null;
}
function scalar(node, source) {
    if (!node) return '';
    if (node.type === 'Literal') return String(node.value);
    return source.slice(node.start, node.end).replace(/\s+/g, ' ').slice(0, 100);
}
function classify(row, raw) {
    if (row.method === 'mixin' || /\btoast\s*:\s*true/.test(raw)) return 'TOAST';
    if (/iframe|pdf-preview|PDF|pdfUrl|pdfUrlToUse/i.test(raw) && /iframe|width\s*:\s*1[02]\d\d/i.test(raw)) return 'PDF_PREVIEW';
    if (/showLoading|progress|Πρόοδος|Ανάκτηση PDF/i.test(raw) && /showConfirmButton\s*:\s*false/.test(raw)) return 'PROGRESS';
    if (/<table|preview|προεπισκόπ|σύγκριση|comparison/i.test(raw)) return 'COMPLEX_TABLE/PREVIEW';
    if (/employment-review|scheduler|custom-swal-popup-wide|wide-popup|erganh-dashboard/i.test(raw)) return 'INTENTIONAL_WIDE';
    if (/showCancelButton\s*:\s*true|showDenyButton\s*:\s*true|preConfirm\s*:/.test(raw) || row.icon === 'question') return 'CONFIRMATION';
    if (row.icon === 'error') return 'ERROR';
    if (row.icon === 'warning') return 'WARNING';
    if (row.icon === 'success') return 'SUCCESS';
    return 'STANDARD';
}
function inventory(sourceOverride = {}) {
    const rows = [];
    for (const file of files(path.join(root, 'public/js'), '.js')) {
        const source = sourceOverride[path.relative(root, file)] ?? fs.readFileSync(file, 'utf8');
        const relative = path.relative(root, file);
        let ast;
        try { ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowReturnOutsideFunction: true }); }
        catch (error) {
            // One existing file has a duplicate declaration. Preserve its call in the inventory.
            const re = /\b(?:window\.|global\.)?(?:Swal|swal)\.(fire|mixin)\s*\(/g;
            let match;
            while ((match = re.exec(source))) rows.push({ file: relative, line: source.slice(0, match.index).split('\n').length,
                function: 'parse fallback', method: match[1], title: '', icon: '', customClass: '', width: '',
                classification: 'STANDARD', parseWarning: error.message });
            continue;
        }
        function walk(node, stack = []) {
            if (!node || typeof node !== 'object' || !node.type) return;
            if (node.type === 'CallExpression' && /^(?:window\.|global\.)?(?:Swal|swal)\.(?:fire|mixin)$/.test(name(node.callee))) {
                const options = node.arguments[0];
                const raw = source.slice(node.start, node.end);
                const fn = [...stack].reverse().find(item => item.type === 'FunctionDeclaration' || item.type === 'MethodDefinition' ||
                    item.type === 'VariableDeclarator' && /FunctionExpression|ArrowFunctionExpression/.test(item.init?.type));
                const row = { file: relative, line: node.loc.start.line,
                    function: name(fn?.id || fn?.key) || '(anonymous)', method: name(node.callee).split('.').pop(),
                    title: scalar(property(options, 'title'), source), icon: scalar(property(options, 'icon') || property(options, 'type'), source),
                    customClass: property(options, 'customClass') ? source.slice(property(options, 'customClass').start,
                        property(options, 'customClass').end).replace(/\s+/g, ' ') : '',
                    width: scalar(property(options, 'width'), source) };
                row.classification = classify(row, raw);
                row.canonical = /custom-swal-popup|standardClasses\(/.test(row.customClass);
                rows.push(row);
            }
            for (const [key, value] of Object.entries(node)) {
                if (key === 'loc' || key === 'start' || key === 'end') continue;
                if (Array.isArray(value)) value.forEach(child => walk(child, [...stack, node]));
                else walk(value, [...stack, node]);
            }
        }
        walk(ast);
    }
    for (const file of files(path.join(root, 'views'), '.ejs')) {
        const source = sourceOverride[path.relative(root, file)] ?? fs.readFileSync(file, 'utf8');
        const re = /\b(?:window\.|global\.)?(?:Swal|swal)\.(fire|mixin)\s*\(/g;
        let match;
        while ((match = re.exec(source))) {
            const raw = source.slice(match.index, match.index + 1200);
            const row = { file: path.relative(root, file), line: source.slice(0, match.index).split('\n').length,
                function: '(inline EJS)', method: match[1], title: raw.match(/title\s*:\s*['"`]([^'"`\n]+)/)?.[1] || '',
                icon: raw.match(/(?:icon|type)\s*:\s*['"]([^'"]+)/)?.[1] || '',
                customClass: raw.match(/customClass\s*:\s*\{[\s\S]*?\}/)?.[0] || '',
                width: raw.match(/\bwidth\s*:\s*([^,\n}]+)/)?.[1] || '' };
            row.classification = classify(row, raw);
            row.canonical = /custom-swal-popup/.test(row.customClass);
            rows.push(row);
        }
    }
    rows.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
    const ordinals = new Map();
    for (const row of rows) {
        const normalized = value => String(value || '').replace(/\s+/g, ' ').trim();
        const signature = [row.file, row.function, row.classification, normalized(row.title),
            normalized(row.icon), normalized(row.customClass), row.method, normalized(row.width)].join('\u0000');
        const ordinal = ordinals.get(signature) || 0;
        ordinals.set(signature, ordinal + 1);
        row.fingerprint = crypto.createHash('sha256').update(`${signature}\u0000${ordinal}`).digest('hex');
    }
    return rows;
}

if (require.main === module) {
    const rows = inventory();
    const ordinary = rows.filter(row => ['ERROR', 'WARNING', 'SUCCESS'].includes(row.classification));
    const unstyled = ordinary.filter(row => !row.canonical && !row.width && !/ergani-swal-popup/.test(row.customClass));
    if (process.argv.includes('--check')) {
        const css = fs.readFileSync(path.join(root, 'public/css/main.css'), 'utf8');
        const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'sweetAlertOrdinaryLegacyBaseline.json'), 'utf8'));
        const newUnstyled = unstyled.filter(row => !baseline.includes(row.fingerprint));
        if (newUnstyled.length || !css.includes(':has(> .swal2-icon.swal2-error)') ||
            !css.includes(':has(> .swal2-icon.swal2-warning)') ||
            !css.includes(':has(> .swal2-icon.swal2-success)')) {
            console.error(`SweetAlert styling regression: ${newUnstyled.map(row => `${row.file}:${row.line}`).join(', ')}`);
            process.exitCode = 1;
        } else console.log(`SweetAlert styling audit passed: ${rows.length} calls, ${unstyled.length} legacy ordinary dialogs covered by CSS.`);
    } else if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 2));
    else if (process.argv.includes('--inventory')) {
        console.log('file\tline\tfunction\ttitle\ticon/type\tcustomClass\texplicit width\tclassification');
        for (const row of rows) console.log([row.file, row.line, row.function, row.title, row.icon,
            row.customClass, row.width, row.classification].map(value => String(value).replace(/[\t\r\n]/g, ' ')).join('\t'));
    } else {
        const counts = Object.fromEntries([...new Set(rows.map(row => row.classification))].sort()
            .map(type => [type, rows.filter(row => row.classification === type).length]));
        console.log(JSON.stringify({ occurrences: rows.length, counts }, null, 2));
    }
}

module.exports = { inventory };
