const fs = require('fs');
const path = require('path');

const results = {
    withCSRF: [],
    withoutCSRF:  [],
    getRequests: [],
    allFiles: [],
    fixes: []
};

function generateFixedCode(original, type, lineNum, filePath) {
    const lines = original.split('\n');
    let fixed = '';
    
    if (type === 'fetch') {
        // Fix για fetch()
        fixed = `// ✅ FIXED: Added CSRF token to fetch request (Line ${lineNum})\n`;
        fixed += `const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || \n`;
        fixed += `                  document.getElementById('csrfToken')?.value || '';\n\n`;
        
        // Find the fetch line
        let fetchLineIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (/\bfetch\s*\(/.test(lines[i])) {
                fetchLineIndex = i;
                break;
            }
        }
        
        if (fetchLineIndex >= 0) {
            // Add lines before fetch
            for (let i = 0; i < fetchLineIndex; i++) {
                fixed += lines[i] + '\n';
            }
            
            // Add fetch with CSRF
            const indent = lines[fetchLineIndex].match(/^\s*/)[0];
            fixed += lines[fetchLineIndex] + '\n';
            
            // Check if headers already exist
            let hasHeaders = false;
            for (let i = fetchLineIndex; i < Math.min(fetchLineIndex + 10, lines.length); i++) {
                if (/headers\s*: /.test(lines[i])) {
                    hasHeaders = true;
                    break;
                }
            }
            
            if (hasHeaders) {
                // Add to existing headers
                for (let i = fetchLineIndex + 1; i < lines.length; i++) {
                    if (/headers\s*:\s*\{/.test(lines[i])) {
                        fixed += lines[i] + '\n';
                        fixed += indent + `        'csrf-token': csrfToken,\n`;
                    } else {
                        fixed += lines[i] + '\n';
                    }
                }
            } else {
                // Add new headers object
                for (let i = fetchLineIndex + 1; i < lines.length; i++) {
                    if (/method\s*: /.test(lines[i]) || /body\s*:/.test(lines[i])) {
                        fixed += lines[i] + '\n';
                        if (i === fetchLineIndex + 1 || /,\s*$/.test(lines[i - 1])) {
                            fixed += indent + `    headers: {\n`;
                            fixed += indent + `        'csrf-token': csrfToken,\n`;
                            fixed += indent + `        'Content-Type': 'application/json'\n`;
                            fixed += indent + `    },\n`;
                        }
                    } else {
                        fixed += lines[i] + '\n';
                    }
                }
            }
        }
        
    } else if (type === 'ajax') {
        // Fix για jQuery $. ajax()
        fixed = `// ✅ FIXED: Added CSRF token to jQuery ajax request (Line ${lineNum})\n`;
        fixed += `const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || \n`;
        fixed += `                  document.getElementById('csrfToken')?.value || '';\n\n`;
        
        let ajaxLineIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (/\$\s*\.\s*ajax\s*\(/.test(lines[i]) || /\$\s*\.\s*post\s*\(/.test(lines[i])) {
                ajaxLineIndex = i;
                break;
            }
        }
        
        if (ajaxLineIndex >= 0) {
            for (let i = 0; i < ajaxLineIndex; i++) {
                fixed += lines[i] + '\n';
            }
            
            const indent = lines[ajaxLineIndex].match(/^\s*/)[0];
            fixed += lines[ajaxLineIndex] + '\n';
            
            // Check if headers exist
            let hasHeaders = false;
            for (let i = ajaxLineIndex; i < Math. min(ajaxLineIndex + 15, lines.length); i++) {
                if (/headers\s*:/.test(lines[i])) {
                    hasHeaders = true;
                }
            }
            
            if (hasHeaders) {
                for (let i = ajaxLineIndex + 1; i < lines. length; i++) {
                    if (/headers\s*:\s*\{/.test(lines[i])) {
                        fixed += lines[i] + '\n';
                        fixed += indent + `        'csrf-token': csrfToken,\n`;
                    } else {
                        fixed += lines[i] + '\n';
                    }
                }
            } else {
                // Add headers after url or type
                for (let i = ajaxLineIndex + 1; i < lines.length; i++) {
                    fixed += lines[i] + '\n';
                    if (/url\s*:/.test(lines[i]) || /type\s*:/. test(lines[i])) {
                        fixed += indent + `    headers: {\n`;
                        fixed += indent + `        'csrf-token': csrfToken\n`;
                        fixed += indent + `    },\n`;
                    }
                }
            }
        }
        
    } else if (type === 'axios') {
        // Fix για axios
        fixed = `// ✅ FIXED:  Added CSRF token to axios request (Line ${lineNum})\n`;
        fixed += `const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || \n`;
        fixed += `                  document.getElementById('csrfToken')?.value || '';\n\n`;
        
        for (let i = 0; i < lines.length; i++) {
            if (/axios\s*\.\s*(post|put|patch|delete)/.test(lines[i])) {
                const indent = lines[i].match(/^\s*/)[0];
                fixed += lines[i] + '\n';
                
                // Check if config object exists
                let hasConfig = false;
                for (let j = i; j < Math.min(i + 10, lines.length); j++) {
                    if (/headers\s*:/.test(lines[j])) {
                        hasConfig = true;
                        break;
                    }
                }
                
                if (! hasConfig) {
                    // Add config object with headers
                    let foundClosingParen = false;
                    for (let j = i + 1; j < lines.length; j++) {
                        if (! foundClosingParen && /\)/.test(lines[j])) {
                            fixed += indent + `, {\n`;
                            fixed += indent + `    headers: {\n`;
                            fixed += indent + `        'csrf-token': csrfToken\n`;
                            fixed += indent + `    }\n`;
                            fixed += indent + `}` + lines[j]. trim() + '\n';
                            foundClosingParen = true;
                        } else {
                            fixed += lines[j] + '\n';
                        }
                    }
                }
            } else {
                fixed += lines[i] + '\n';
            }
        }
    }
    
    return fixed || original;
}

function checkCSRFInFile(filePath, content) {
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        
        const hasFetch = /\bfetch\s*\(/.test(line);
        const hasAjax = /\$\s*\.\s*(ajax|post|get|getJSON)\s*\(/.test(line);
        const hasAxios = /\baxios\s*\.\s*(post|put|patch|delete|get)\s*\(/.test(line);
        const hasXHR = /new\s+XMLHttpRequest/.test(line);
        
        if (hasFetch || hasAjax || hasAxios || hasXHR) {
            
            let hasCSRF = false;
            let contextLines = [];
            let isGET = false;
            
            for (let j = Math.max(0, i - 2); j < Math.min(i + 25, lines.length); j++) {
                const contextLine = lines[j];
                contextLines.push(contextLine);
                
                if (
                    /['"]csrf-token['"]/i.test(contextLine) ||
                    /['"]csrfToken['"]/i. test(contextLine) ||
                    /['"]_csrf['"]/i.test(contextLine) ||
                    /['"]x-csrf-token['"]/i.test(contextLine) ||
                    /['"]CSRF-Token['"]/i.test(contextLine) ||
                    /csrfToken\s*:/i.test(contextLine) ||
                    /_csrf\s*:/i.test(contextLine)
                ) {
                    hasCSRF = true;
                }
                
                if (
                    /method\s*:\s*['"]GET['"]/i.test(contextLine) || 
                    /type\s*:\s*['"]GET['"]/i.test(contextLine) ||
                    /\.\s*get\s*\(/. test(contextLine)
                ) {
                    isGET = true;
                }
            }
            
            const codePreview = contextLines.join('\n').trim();
            const requestType = hasFetch ? 'fetch' :  hasAjax ? 'ajax' : hasAxios ? 'axios' : 'xhr';
            
            const requestData = {
                file: filePath,
                line: lineNum,
                code: codePreview. substring(0, 300),
                type: requestType
            };
            
            if (isGET) {
                results.getRequests.push(requestData);
            } else if (hasCSRF) {
                results.withCSRF. push(requestData);
            } else {
                results.withoutCSRF.push(requestData);
                
                // Generate fix
                const fixedCode = generateFixedCode(codePreview, requestType, lineNum, filePath);
                results.fixes.push({
                    file: filePath,
                    line: lineNum,
                    type: requestType,
                    original: codePreview. substring(0, 300),
                    fixed: fixedCode
                });
            }
        }
    }
}

function walkDirectory(dir, exclude = ['node_modules', '.git', 'uploads', 'build', 'dist', 'coverage']) {
    try {
        const files = fs. readdirSync(dir);
        
        files.forEach(file => {
            const filePath = path.join(dir, file);
            
            if (exclude.includes(file)) {
                return;
            }
            
            if (filePath.includes(path.join('public', 'min.js'))) {
                return;
            }
            
            if (filePath.includes(path. sep + 'build' + path.sep)) {
                return;
            }
            
            try {
                const stat = fs.statSync(filePath);
                
                if (stat.isDirectory()) {
                    walkDirectory(filePath, exclude);
                } else if ((file.endsWith('.js') || file.endsWith('. ejs')) && !file.endsWith('. min.js')) {
                    results.allFiles.push(filePath);
                    const content = fs.readFileSync(filePath, 'utf8');
                    checkCSRFInFile(filePath, content);
                }
            } catch (err) {
                // Skip
            }
        });
    } catch (err) {
        console.error(`Error reading directory ${dir}:`, err.message);
    }
}

// Run check
console.log('🔍 Checking CSRF tokens in all HTTP requests...');
console.log(`📂 Starting from:  ${process.cwd()}`);
console.log(`🚫 Excluding: node_modules, .git, uploads, build, public/min.js\n`);

walkDirectory('.');

// Print results
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📊 CSRF CHECK RESULTS:`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`   📁 Files scanned:         ${results.allFiles.length}`);
console.log(`   ✅ With CSRF token:      ${results.withCSRF. length}`);
console.log(`   ❌ WITHOUT CSRF token:   ${results. withoutCSRF.length}`);
console.log(`   ℹ️  GET requests:        ${results.getRequests.length} (CSRF not needed)`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (results.withoutCSRF.length > 0) {
    console.log('⚠️  REQUESTS WITHOUT CSRF TOKEN (NEED FIX):\n');
    results.withoutCSRF.forEach((r, index) => {
        console.log(`${index + 1}. 📍 ${r.file}:${r.line} (${r.type})`);
    });
    console.log('');
} else {
    console.log('🎉 All POST/PUT/DELETE requests have CSRF tokens!\n');
}

if (results.withCSRF.length > 0) {
    console.log(`✅ ${results.withCSRF.length} requests with CSRF token (CORRECT)\n`);
}

if (results.getRequests.length > 0) {
    console.log(`ℹ️  ${results. getRequests.length} GET requests found (CSRF not required)\n`);
}

// Save fixes to txt file
if (results.fixes.length > 0) {
    let fixContent = '═══════════════════════════════════════════════════════════════\n';
    fixContent += '                    CSRF FIXES - AUTO-GENERATED\n';
    fixContent += `                    Generated:  ${new Date().toISOString()}\n`;
    fixContent += '═══════════════════════════════════════════════════════════════\n\n';
    fixContent += `Total fixes needed: ${results.fixes.length}\n\n`;
    
    results.fixes.forEach((fix, index) => {
        fixContent += `\n${'='.repeat(70)}\n`;
        fixContent += `FIX #${index + 1}\n`;
        fixContent += `${'='.repeat(70)}\n`;
        fixContent += `File: ${fix.file}\n`;
        fixContent += `Line: ${fix.line}\n`;
        fixContent += `Type: ${fix.type}\n`;
        fixContent += `\n--- ORIGINAL CODE ---\n`;
        fixContent += fix.original + '\n';
        fixContent += `\n--- FIXED CODE ---\n`;
        fixContent += fix.fixed + '\n';
        fixContent += `${'='.repeat(70)}\n\n`;
    });
    
    fs.writeFileSync('csrf-fixes.txt', fixContent, 'utf8');
    console.log('✅ Fixes saved to:  csrf-fixes.txt\n');
}

// Save JSON report
const report = {
    summary: {
        filesScanned: results.allFiles. length,
        withCSRF: results.withCSRF.length,
        withoutCSRF: results.withoutCSRF.length,
        getRequests: results.getRequests.length,
        fixesGenerated: results.fixes.length
    },
    details: results
};

fs.writeFileSync('csrf-check-report.json', JSON.stringify(report, null, 2));
console.log('✅ Full report saved to: csrf-check-report.json');

// Summary
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (results.withoutCSRF.length === 0 && results.withCSRF. length > 0) {
    console.log('🏆 PERFECT! All requests are properly protected with CSRF tokens!');
} else if (results.withoutCSRF.length > 0) {
    console.log(`⚠️  WARNING: ${results.withoutCSRF.length} requests need CSRF protection! `);
    console.log(`📝 Check csrf-fixes.txt for suggested fixes`);
} else if (results.withCSRF.length === 0 && results.getRequests. length === 0) {
    console.log('ℹ️  No HTTP requests found in the project.');
}
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

process.exit(results.withoutCSRF.length > 0 ? 1 : 0);