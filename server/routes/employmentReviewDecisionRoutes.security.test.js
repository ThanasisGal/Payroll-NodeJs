'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const source = fs.readFileSync(path.join(__dirname, 'usersRoute.js'), 'utf8');

function routeBlock(route, occurrence = 0) {
    let index = -1;
    for (let count = 0; count <= occurrence; count++) index = source.indexOf(`'${route}'`, index + 1);
    assert.ok(index >= 0, `${route} missing`);
    const end = source.indexOf('\n);', index);
    assert.ok(end >= 0, `${route}: route terminator missing`);
    return source.slice(index, end + 3);
}

const readRoutes = [
    '/api/prodhlomena-oraria/review',
    '/api/prodhlomena-oraria/review/period-control/current',
    '/api/prodhlomena-oraria/review/:id/audit',
    '/api/prodhlomena-oraria/review/canonical-decisions/current',
    '/api/prodhlomena-oraria/review/canonical-decisions'
];
for (const route of readRoutes) {
    const block = routeBlock(route);
    assert.ok(block.includes('checkAuth'), `${route}: checkAuth missing`);
    assert.ok(block.includes('requireEmploymentReviewAccess'), `${route}: read privilege missing`);
    assert.ok(!block.includes('requireCriticalEmploymentDecisionRole'), `${route}: read restricted by role`);
}

const mutationRoutes = [
    ['/api/prodhlomena-oraria/review/period-control/:action(lock|unlock)', 0],
    ['/api/prodhlomena-oraria/review/policies/apply-execution', 0],
    ['/api/prodhlomena-oraria/review/policies/approvals', 1],
    ['/api/prodhlomena-oraria/review/policies/approvals/:approvalId/revoke', 0],
    ['/api/prodhlomena-oraria/review/canonical-decisions', 1],
    ['/api/prodhlomena-oraria/review/repo-transfer-decisions', 1],
    ['/api/prodhlomena-oraria/review/repo-transfer-decisions/:decisionId/apply', 0],
    ['/api/prodhlomena-oraria/review/:id', 0],
    ['/api/prodhlomena-oraria/review/:id/unlock', 0],
    ['/api/prodhlomena-oraria/review/:id/restore/:auditId', 0]
];
for (const [route, occurrence] of mutationRoutes) {
    const block = routeBlock(route, occurrence);
    assert.ok(block.includes('checkAuth'), `${route}: checkAuth missing`);
    assert.ok(block.includes('requireEmploymentReviewAccess'), `${route}: form privilege missing`);
    assert.ok(block.includes('requireCriticalEmploymentDecisionRole'), `${route}: critical role missing`);
}

console.log(`employment review decision route security tests passed (${readRoutes.length} read, ${mutationRoutes.length} mutation routes)`);
