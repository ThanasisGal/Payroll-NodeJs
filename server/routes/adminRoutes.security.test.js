'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, 'adminRoutes.js'), 'utf8');
assert.ok(source.includes("const requireAdminRole = require('../middlewares/requireAdminRole')"));
assert.ok(!source.includes('function requireAdmin('));
assert.match(source, /router\.get\('\/aws_s3', requireAdminRole,/);
assert.match(
    source,
    /router\.post\(\s*'\/templates\/upload',\s*requireAdminRole,\s*uploadTextTemplate\.array\('files', 20\),\s*uploadTextTemplateController\.uploadTemplates/s
);
console.log('PASS admin routes use centralized active Admin authorization before multer');
