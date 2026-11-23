'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { startApprovedProposalMongo } = require('../fixtures/employeeHistoryApprovedProposalMongo');
const mongoose = require('mongoose');
const binary = process.env.PAYROLL_APPROVED_PROPOSAL_TEST_MONGOD;

for (const interrupted of [false, true]) test(`Απομονωμένη MongoDB: κλείσιμο ${interrupted ? 'μετά από τερματισμό με σήμα' : 'κανονικά'}`,
    { skip: !binary, timeout: 30000 }, async t => {
        const db = await startApprovedProposalMongo(binary);
        t.after(db.close);
        if (interrupted) {
            const exited = once(db.child, 'exit');
            db.child.kill('SIGKILL');
            await exited;
            assert.equal(db.child.exitCode, null);
            assert.equal(db.child.signalCode, 'SIGKILL');
        }
        await db.close();
        await db.close();
        assert.equal(db.connection.readyState, 0);
        assert.ok(db.child.exitCode !== null || db.child.signalCode !== null);
        assert.equal(db.child.listenerCount('exit'), 0);
        assert.equal(mongoose.connection.readyState, 0);
    });
