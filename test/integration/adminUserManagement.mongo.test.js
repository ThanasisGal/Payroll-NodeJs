'use strict';

// Own a disposable loopback replica set. Never read .env or accept a database URI.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { createRequire } = require('node:module');
const vm = require('node:vm');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

function response() {
    return { statusCode: 200, flashes: [], redirects: [],
        status(code) { this.statusCode = code; return this; },
        render() { return this; }, send() { return this; },
        redirect(url) { this.redirects.push(url); return this; },
        async flash(type, message) { this.flashes.push({ type, message }); } };
}
const body = email => ({ firstName: 'Synthetic', lastName: 'User', email, password: ' Synthetic1! ',
    team: 'TEAM1', radioRoles: 'HR', radioStatus: 'A', details: '' });
const actor = { userId: '650000000000000000000001', role: 'A', team: 'TEAM1' };
const reference = res => res.flashes.map(item => item.message).join('\n');
function sessionStore(sessions = {}) {
    return { all: cb => cb(null, sessions), get: (sid, cb) => cb(null, sessions[sid]),
        destroy(sid, cb) { delete sessions[sid]; cb(null); } };
}

test('Admin user creation and password changes on an owned MongoDB', { timeout: 90000 }, async t => {
    const binary = process.env.PAYROLL_ADMIN_TEST_MONGOD;
    assert.ok(binary && path.isAbsolute(binary), 'An explicit local mongod binary is required');
    await fs.access(binary);
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'payroll-admin-users-mongo-'));
    const socket = net.createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    const child = spawn(binary, ['--dbpath', directory, '--port', String(port), '--bind_ip', '127.0.0.1',
        '--replSet', 'payrollAdminUsersTest', '--logpath', path.join(directory, 'mongod.log')], { stdio: 'ignore' });
    child.on('error', () => {});
    let client, connection;
    const forbidden = () => { throw new Error('APPLICATION_DATABASE_FORBIDDEN'); };
    const originalConnect = mongoose.connect, originalOpen = mongoose.connection.openUri;
    mongoose.connect = forbidden; mongoose.connection.openUri = forbidden;
    try {
        client = new mongoose.mongo.MongoClient(`mongodb://127.0.0.1:${port}/?directConnection=true`, { serverSelectionTimeoutMS: 15000 });
        await client.connect();
        assert.equal((await client.db('admin').command({ serverStatus: 1 })).pid, child.pid);
        assert.equal((await client.db('admin').command({ getCmdLineOpts: 1 })).parsed.storage.dbPath, directory);
        await client.db('admin').command({ replSetInitiate: { _id: 'payrollAdminUsersTest',
            members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
        await client.close(); client = null;
        connection = await mongoose.createConnection(`mongodb://127.0.0.1:${port}/payroll_admin_users_test?replicaSet=payrollAdminUsersTest`,
            { autoCreate: false, autoIndex: false, serverSelectionTimeoutMS: 15000 }).asPromise();
        const User = connection.model('User', require('../../server/models/userModel').schema.clone());
        const privilegeExports = require('../../server/models/privileges');
        const Privileges = connection.model('userPrivileges', privilegeExports.UserPrivilegesModel.schema.clone());
        await User.createCollection(); await Privileges.createCollection(); await Privileges.createIndexes();
        await User.collection.createIndex({ email: 1 }, { unique: true });
        const templateId = '650000000000000000000099';
        await Privileges.create([{ userId: templateId, form: 'Companies', privileges: { read: true } },
            { userId: templateId, form: 'Ergazomenoi', privileges: { read: true, update: true } }]);
        const filename = path.resolve(__dirname, '../../server/controllers/userController.js');
        const originalRequire = createRequire(filename);
        const stubs = { '../models/userModel': User,
            '../models/privileges': { ...privilegeExports, UserPrivilegesModel: Privileges },
            '../../server/utils/logger': { error() {}, warn() {}, info() {} },
            '../../config/emailConfig': { sendMail: forbidden }, '../../config/sessionOpts': { sessionOpts: {} } };
        const module = { exports: {} };
        vm.runInThisContext('(function(require,module,exports,__filename,__dirname,process){' + await fs.readFile(filename, 'utf8') + '\n})', { filename })(
            name => Object.hasOwn(stubs, name) ? stubs[name] : originalRequire(name), module, module.exports,
            filename, path.dirname(filename), { env: { NODE_ENV: 'test', PROTYPO_ID: templateId } });
        const controller = module.exports;
        const submit = async email => { const res = response(); await controller.postUser({ adminActor: actor, body: body(email) }, res); return res; };
        let saved;
        await t.test('creation commits the user and copied privileges and preserves main verification policy', async () => {
            const res = await submit('created@example.invalid');
            assert.deepEqual(res.redirects, ['/admin']);
            saved = await User.findOne({ email: 'created@example.invalid' }).lean();
            assert.equal(saved.isVerified, false);
            assert.equal(await bcrypt.compare(' Synthetic1! ', saved.password), true);
            assert.equal(await bcrypt.compare('Synthetic1!', saved.password), false);
            assert.equal(await Privileges.countDocuments({ userId: String(saved._id) }), 2);
        });
        await t.test('failure after a real privilege insertion rolls back both collections and is not an email error', async () => {
            const insert = Privileges.insertMany;
            let failedUserId;
            Privileges.insertMany = async (rows, options) => {
                failedUserId = rows[0].userId;
                await insert.call(Privileges, [rows[0]], options);
                throw Object.assign(new Error('synthetic privilege conflict'), { code: 11000 });
            };
            try {
                const res = await submit('rollback@example.invalid');
                assert.match(reference(res), /ADMIN_USER_PRIVILEGES_COPY_FAILED/);
                assert.match(reference(res), /Δεν αποθηκεύτηκε καμία αλλαγή/);
                assert.doesNotMatch(reference(res), /ADMIN_USER_EMAIL_EXISTS/);
                assert.equal(await User.countDocuments({ email: 'rollback@example.invalid' }), 0);
                assert.equal(await Privileges.countDocuments({ userId: failedUserId }), 0);
            } finally { Privileges.insertMany = insert; }
        });
        await t.test('existing email is distinguished without another write', async () => {
            assert.match(reference(await submit('created@example.invalid')), /ADMIN_USER_EMAIL_EXISTS/);
            assert.equal(await User.countDocuments({ email: 'created@example.invalid' }), 1);
        });
        await t.test('an email collision during insertion is distinguished from privilege failures', async () => {
            const create = User.create;
            User.create = async () => { throw Object.assign(new Error('synthetic concurrent email'),
                { code: 11000, keyPattern: { email: 1 } }); };
            try {
                assert.match(reference(await submit('collision@example.invalid')), /ADMIN_USER_EMAIL_EXISTS/);
                assert.equal(await User.countDocuments({ email: 'collision@example.invalid' }), 0);
            } finally { User.create = create; }
        });
        await t.test('an uncertain commit result asks for verification without claiming rollback', async () => {
            const start = connection.startSession;
            connection.startSession = async () => ({
                withTransaction: async () => { throw Object.assign(new Error('synthetic uncertain commit'),
                    { hasErrorLabel: label => label === 'UnknownTransactionCommitResult' }); }, endSession: async () => {}
            });
            try {
                const message = reference(await submit('uncertain@example.invalid'));
                assert.match(message, /ADMIN_USER_CREATE_OUTCOME_UNKNOWN/);
                assert.doesNotMatch(message, /Δεν αποθηκεύτηκε καμία αλλαγή/);
            } finally { connection.startSession = start; }
        });
        await t.test('transaction startup failure leaves no user', async () => {
            const start = connection.startSession;
            connection.startSession = async () => { throw new Error('synthetic session failure'); };
            try {
                assert.match(reference(await submit('transaction@example.invalid')), /ADMIN_USER_CREATE_TRANSACTION_FAILED/);
                assert.equal(await User.countDocuments({ email: 'transaction@example.invalid' }), 0);
            } finally { connection.startSession = start; }
        });
        await t.test('transaction failure after preparation aborts all writes', async () => {
            const start = connection.startSession;
            connection.startSession = async () => {
                const session = await start.call(connection);
                session.withTransaction = async work => {
                    session.startTransaction();
                    await work(); await session.abortTransaction();
                    throw new Error('synthetic commit failure');
                };
                return session;
            };
            const before = await Privileges.countDocuments();
            try {
                assert.match(reference(await submit('commit@example.invalid')), /ADMIN_USER_CREATE_TRANSACTION_FAILED/);
                assert.equal(await User.countDocuments({ email: 'commit@example.invalid' }), 0);
                assert.equal(await Privileges.countDocuments(), before);
            } finally { connection.startSession = start; }
        });
        const edit = async (extra = {}, options = {}) => {
            const res = response();
            await controller.editPostUser({ adminActor: actor, params: { id: String(saved._id) },
                body: { ...body(saved.email), ...extra }, ...options }, res);
            return res;
        };
        await t.test('empty new password preserves the stored hash', async () => {
            await edit({ newPassword: '', newPasswordConfirmation: '', firstName: 'Changed' });
            const after = await User.findById(saved._id).lean();
            assert.equal(after.password, saved.password); assert.equal(after.firstName, 'Changed');
        });
        await t.test('matching passwords retain surrounding spaces and revoke only other target sessions', async () => {
            const sessions = { target: { userId: String(saved._id) }, unrelated: { userId: actor.userId } };
            const res = await edit({ newPassword: ' NewSynthetic1! ', newPasswordConfirmation: ' NewSynthetic1! ' },
                { sessionStore: sessionStore(sessions), sessionID: 'unrelated' });
            assert.deepEqual(res.redirects, ['/admin']);
            saved = await User.findById(saved._id).lean();
            assert.equal(await bcrypt.compare(' NewSynthetic1! ', saved.password), true);
            assert.equal(await bcrypt.compare('NewSynthetic1!', saved.password), false);
            assert.deepEqual(Object.keys(sessions), ['unrelated']);
        });
        await t.test('different raw confirmation, weak passwords and non-string fields cannot change the password', async () => {
            for (const extra of [
                { newPassword: ' NewSynthetic1! ', newPasswordConfirmation: 'NewSynthetic1!' },
                { newPassword: 'weak', newPasswordConfirmation: 'weak' },
                { newPassword: {}, newPasswordConfirmation: '' }
            ]) {
                const res = await edit(extra);
                assert.match(reference(res), /Δεν αποθηκεύτηκε καμία αλλαγή/);
                assert.equal((await User.findById(saved._id).lean()).password, saved.password);
            }
        });
        await t.test('foreign group and Supervisor-protected role cannot reset the target password', async () => {
            for (const denied of [{ ...actor, team: 'OTHER' }, { ...actor, role: 'S' }]) {
                if (denied.role === 'S') await User.updateOne({ _id: saved._id }, { privileges: 'A' });
                const res = await edit({ newPassword: 'Forbidden1!', newPasswordConfirmation: 'Forbidden1!' }, { adminActor: denied });
                assert.equal(res.statusCode, 404);
                assert.equal((await User.findById(saved._id).lean()).password, saved.password);
            }
            await User.updateOne({ _id: saved._id }, { privileges: 'HR' });
        });
        await t.test('unavailable session store prevents password persistence', async () => {
            const res = await edit({ newPassword: 'BlockedSynthetic1!', newPasswordConfirmation: 'BlockedSynthetic1!' });
            assert.match(reference(res), /ADMIN_USER_PASSWORD_SESSIONS_UNAVAILABLE/);
            assert.equal((await User.findById(saved._id).lean()).password, saved.password);
        });
        await t.test('revocation failure explicitly reports the already saved password', async () => {
            const store = sessionStore({ target: { userId: String(saved._id) } });
            store.destroy = (sid, cb) => cb(new Error('synthetic destroy failure'));
            const res = await edit({ newPassword: 'SavedSynthetic1!', newPasswordConfirmation: 'SavedSynthetic1!' }, { sessionStore: store });
            assert.match(reference(res), /ADMIN_USER_PASSWORD_SESSIONS_INCOMPLETE/);
            assert.match(reference(res), /αποθηκεύτηκαν/);
            assert.equal(await bcrypt.compare('SavedSynthetic1!', (await User.findById(saved._id).lean()).password), true);
        });
        assert.equal(mongoose.connection.readyState, 0);
    } finally {
        mongoose.connect = originalConnect; mongoose.connection.openUri = originalOpen;
        await client?.close(); await connection?.close();
        if (child.pid && child.exitCode === null && child.signalCode === null) {
            const exited = once(child, 'exit'); child.kill('SIGTERM'); await exited;
        }
    }
});
