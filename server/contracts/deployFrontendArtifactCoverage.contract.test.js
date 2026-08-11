'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const deployScriptPath = path.join(repositoryRoot, 'deploy-ubuntu.sh');
const viewsRoot = path.join(repositoryRoot, 'views');
const deployScript = fs.readFileSync(deployScriptPath, 'utf8');

const expectedCoverage = [
    'admin/userPrivilegesManagement',
    'kinhseis/apasxolhseis/payrollPhasesPanel',
    'Krathseis/nestingTables',
    'Krathseis/selectRowInTable',
    'Krathseis/selectRowsInNestedTable',
    'ergazomenoi/genika/erganiRestSubmissionUi',
    'ergazomenoi/genika/alles_parathrhseis'
];

const productionObfuscationContracts = [
    'ergazomenoi/programmata/elegxosApasxolhseonPeriodoy'
];

function walkFiles(directory, extension) {
    return fs.readdirSync(directory, { withFileTypes: true })
        .flatMap((entry) => {
            const entryPath = path.join(directory, entry.name);
            return entry.isDirectory() ? walkFiles(entryPath, extension) : [entryPath];
        })
        .filter((filePath) => filePath.endsWith(extension))
        .sort();
}

function preserveLinesWithoutHtmlComments(contents) {
    return contents.replace(/<!--[\s\S]*?-->/g, (comment) =>
        comment.replace(/[^\r\n]/g, ' ')
    );
}

function normalizeScriptKey(key) {
    return key.replace(/\.js$/i, '').trim().replace(/\s+/g, '');
}

function relativePath(filePath) {
    return path.relative(repositoryRoot, filePath).split(path.sep).join('/');
}

function collectLiteralScriptReferences() {
    const references = new Map();
    const literalPattern = /script\(\s*(['"])([^'"]+)\1\s*\)/g;

    walkFiles(viewsRoot, '.ejs').forEach((viewPath) => {
        const contents = preserveLinesWithoutHtmlComments(fs.readFileSync(viewPath, 'utf8'));
        contents.split(/\r?\n/).forEach((line, index) => {
            for (const match of line.matchAll(literalPattern)) {
                const key = normalizeScriptKey(match[2]);
                const location = `${relativePath(viewPath)}:${index + 1}`;
                if (!references.has(key)) references.set(key, []);
                references.get(key).push(location);
            }
        });
    });

    return references;
}

function parseProductionArrays() {
    const arrays = new Map();
    let currentArray = null;

    deployScript.split(/\r?\n/).forEach((line) => {
        const declaration = line.match(/^declare\s+-a\s+(\w+)=\($/);
        if (declaration) {
            currentArray = declaration[1];
            arrays.set(currentArray, []);
            return;
        }
        if (currentArray && line.trim() === ')') {
            currentArray = null;
            return;
        }
        if (!currentArray) return;

        const sourceEntry = line.match(/^\s*"(public\/js\/[^"\n]+\.js)"\s*$/);
        if (sourceEntry) arrays.get(currentArray).push(sourceEntry[1]);
    });

    return new Map([...arrays].filter(([, sources]) => sources.length > 0));
}

function parseProcessingLoops() {
    const loops = new Map();
    const loopPattern = /for file in "\$\{(\w+)\[@\]\}"; do\n([\s\S]*?)\ndone/g;

    for (const match of deployScript.matchAll(loopPattern)) {
        const modes = [...match[2].matchAll(/process_file "\$file" (true|false)/g)]
            .map((modeMatch) => modeMatch[1]);
        if (!modes.length) continue;
        if (!loops.has(match[1])) loops.set(match[1], []);
        loops.get(match[1]).push(...modes);
    }

    return loops;
}

function outputPathsFor(sourcePath) {
    const relativeSource = sourcePath.replace(/^public\/js\//, '');
    const baseName = relativeSource.replace(/\.js$/, '');
    return {
        build: `build/${baseName}.min.js`,
        production: `public/min.js/${baseName}.js`
    };
}

const references = collectLiteralScriptReferences();
const productionArrays = parseProductionArrays();
const processingLoops = parseProcessingLoops();
const sourceEntries = new Map();

for (const [arrayName, sources] of productionArrays) {
    sources.forEach((sourcePath) => {
        if (!sourceEntries.has(sourcePath)) sourceEntries.set(sourcePath, []);
        sourceEntries.get(sourcePath).push(arrayName);
    });
}

for (const [key, locations] of references) {
    const sourcePath = `public/js/${key}.js`;
    const absoluteSourcePath = path.join(repositoryRoot, sourcePath);
    assert.ok(
        fs.existsSync(absoluteSourcePath),
        `Literal EJS script "${key}" has no source ${sourcePath}; references: ${locations.join(', ')}`
    );
    assert.strictEqual(
        (sourceEntries.get(sourcePath) || []).length,
        1,
        `Literal EJS script "${key}" must have exactly one deployment-list entry for ${sourcePath}; references: ${locations.join(', ')}`
    );
}

for (const [sourcePath, arrays] of sourceEntries) {
    assert.strictEqual(
        arrays.length,
        1,
        `Deployment source ${sourcePath} is duplicated across arrays: ${arrays.join(', ')}`
    );
    assert.ok(
        fs.existsSync(path.join(repositoryRoot, sourcePath)),
        `Deployment list references nonexistent source ${sourcePath}`
    );
}

for (const [arrayName] of productionArrays) {
    const modes = processingLoops.get(arrayName) || [];
    assert.strictEqual(
        modes.length,
        1,
        `Production array ${arrayName} must be processed by exactly one phase loop`
    );
    const expectedMode = arrayName === 'modules' ? 'true' : 'false';
    assert.strictEqual(
        modes[0],
        expectedMode,
        `Production array ${arrayName} must use process_file "$file" ${expectedMode}`
    );
}

const displayedTotalLine = deployScript.split(/\r?\n/)
    .find((line) => line.includes('echo "Files:') && line.includes('${#modules[@]}'));
const expectedTotalLine = deployScript.split(/\r?\n/)
    .find((line) => line.startsWith('TOTAL_FILES_EXPECTED=') && line.includes('${#modules[@]}'));

assert.ok(displayedTotalLine, 'Displayed production file counter was not found');
assert.ok(expectedTotalLine, 'TOTAL_FILES_EXPECTED counter was not found');

for (const [arrayName] of productionArrays) {
    const counterToken = `\${#${arrayName}[@]\}`;
    assert.ok(
        displayedTotalLine.includes(counterToken),
        `Displayed production file counter omits ${arrayName}`
    );
    assert.ok(
        expectedTotalLine.includes(counterToken),
        `TOTAL_FILES_EXPECTED omits ${arrayName}`
    );
}

for (const key of expectedCoverage) {
    const sourcePath = `public/js/${key}.js`;
    assert.ok(references.has(key), `Expected active EJS script reference is missing: ${key}`);
    assert.strictEqual(
        (sourceEntries.get(sourcePath) || []).length,
        1,
        `Expected deployment coverage is missing or duplicated: ${sourcePath}`
    );

    const expectedOutputs = outputPathsFor(sourcePath);
    assert.strictEqual(
        expectedOutputs.build,
        `build/${key}.min.js`,
        `Unexpected build artifact mapping for ${sourcePath}`
    );
    assert.strictEqual(
        expectedOutputs.production,
        `public/min.js/${key}.js`,
        `Unexpected production artifact mapping for ${sourcePath}`
    );
}

for (const key of productionObfuscationContracts) {
    const sourcePath = `public/js/${key}.js`;
    const expectedOutputs = outputPathsFor(sourcePath);
    const minified = fs.readFileSync(path.join(repositoryRoot, expectedOutputs.build), 'utf8');
    const production = fs.readFileSync(path.join(repositoryRoot, expectedOutputs.production), 'utf8');

    assert.notStrictEqual(
        production,
        minified,
        `${expectedOutputs.production} must contain the production obfuscation output, not the terser-only build artifact`
    );
    assert.match(
        production,
        /document\[['"]querySelector['"]\]/,
        `${expectedOutputs.production} is missing the expected CSP-safe production obfuscation shape`
    );
}

console.log(
    `PASS deploy frontend artifact coverage contract: ${references.size} literal script keys, ` +
    `${sourceEntries.size} deployment sources, ${expectedCoverage.length} repaired assets`
);
