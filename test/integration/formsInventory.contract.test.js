'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');
const inventory = require('../fixtures/responsiveFormsInventory.json');
const { root } = require('../fixtures/responsiveForms');
const { USER_PRIVILEGE_FORM_CATALOG_SEED } = require('../../server/seeds/userPrivilegeFormCatalogSeedData');
const walk = dir => fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);

test('Inventory includes every existing EJS, literal include and rendered page, plus the canonical catalog',()=>{
    const files=walk('views').filter(f=>f.endsWith('.ejs')).sort();
    assert.deepEqual(inventory.templates.map(f=>f.template).sort(),files);
    assert.deepEqual(inventory.catalog,USER_PRIVILEGE_FORM_CATALOG_SEED);
    for(const file of files){
        const source=fs.readFileSync(path.join(root,file),'utf8');
        ejs.compile(source,{filename:path.join(root,file)});
        const includes=[...source.matchAll(/include\(\s*['"]([^'"]+)['"]/g)]
            .map(m=>path.normalize(path.join(path.dirname(file),m[1].replace(/\.ejs$/,'')+'.ejs')));
        assert.deepEqual(inventory.templates.find(t=>t.template===file).includes,includes,file);
    }
    const sourceFiles=['app.js',...walk('server/controllers'),...walk('server/routes')]
        .filter(f=>f.endsWith('.js')&&!f.includes('.test.'));
    const rendered=new Set();
    for(const file of sourceFiles){
        for(const match of fs.readFileSync(path.join(root,file),'utf8').matchAll(/\.render\(\s*['"]([^'"]+)['"]/g)){
            const template='views/'+match[1].replace(/\.ejs$/,'')+'.ejs';
            if(files.includes(template))rendered.add(template);
        }
    }
    assert.deepEqual(inventory.templates.filter(f=>f.kind==='page').map(f=>f.template).sort(),[...rendered].sort());
    assert.ok(inventory.templates.filter(f=>f.kind==='page').every(f=>f.routes.length),'Every page has documented routes');
});
