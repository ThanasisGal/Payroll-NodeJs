'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createOpenErganiPdfHandler } = require('./erganiPdfAccess');
const { requireScopedEmployeeForUpdate } = require('./employeeUpdateScope');

const VALID_ID = '507f1f77bcf86cd799439011';

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        headers: {},
        status(code) {
            this.statusCode = code;
            return this;
        },
        send(value) {
            this.body = value;
            return this;
        },
        json(value) {
            this.body = value;
            return this;
        },
        setHeader(name, value) {
            this.headers[name] = value;
        },
        removeHeader(name) {
            delete this.headers[name];
        },
        redirect(value) {
            this.statusCode = 302;
            this.body = value;
            return this;
        }
    };
}

function createPdfHandler({ record, events = [] }) {
    const model = {
        findOne(filter) {
            events.push({ type: 'lookup', filter });
            return {
                async lean() {
                    events.push({ type: 'lean' });
                    return record;
                }
            };
        }
    };
    const s3Client = {
        async send(command) {
            events.push({ type: 's3', command });
            return {
                ContentType: 'application/pdf',
                ContentLength: 4,
                Body: {
                    pipe(res) {
                        events.push({ type: 'pipe' });
                        res.body = 'streamed';
                        return res;
                    }
                }
            };
        }
    };
    class FakeGetObjectCommand {
        constructor(input) {
            this.input = input;
        }
    }

    return {
        model,
        s3Client,
        handler: createOpenErganiPdfHandler({
            model,
            objectId: { isValid: (value) => value === VALID_ID },
            s3Client,
            GetObjectCommand: FakeGetObjectCommand,
            getBucket: () => 'private-bucket',
            logger: { error: () => {} }
        })
    };
}

test('invalid PDF ObjectId returns 404 without model or S3 access', async () => {
    const events = [];
    const { handler } = createPdfHandler({ record: null, events });
    const res = createResponse();

    await handler(
        {
            params: { id: 'invalid' },
            session: { userTeam: 'team-a', companyInUse: VALID_ID }
        },
        res
    );

    assert.equal(res.statusCode, 404);
    assert.deepEqual(events, []);
});

test('cross-scope PDF miss returns 404 without S3 access', async () => {
    const events = [];
    const { handler } = createPdfHandler({ record: null, events });
    const res = createResponse();

    await handler(
        {
            params: { id: VALID_ID },
            session: { userTeam: 'team-a', companyInUse: 'company-a' }
        },
        res
    );

    assert.equal(res.statusCode, 404);
    assert.equal(events.filter((event) => event.type === 'lookup').length, 1);
    assert.deepEqual(events.find((event) => event.type === 'lookup').filter, {
        _id: VALID_ID,
        team: 'team-a',
        $or: [{ companykod_object: 'company-a' }, { companykod: 'company-a' }]
    });
    assert.equal(events.some((event) => event.type === 's3'), false);
});

test('scoped PDF record is read before S3 and streams iframe-compatible headers', async () => {
    const events = [];
    const { handler } = createPdfHandler({
        events,
        record: { pdf_s3_key: 'private/key.pdf', pdf_s3_url: 's3://private/key.pdf' }
    });
    const res = createResponse();

    await handler(
        {
            params: { id: VALID_ID },
            session: { userTeam: 'team-a', companyInUse: 'company-a' }
        },
        res
    );

    assert.ok(
        events.findIndex((event) => event.type === 'lean') <
            events.findIndex((event) => event.type === 's3')
    );
    assert.equal(res.body, 'streamed');
    assert.equal(res.headers['X-Frame-Options'], 'SAMEORIGIN');
    assert.equal(res.headers['Content-Security-Policy'], "frame-ancestors 'self'");
    assert.equal(res.headers['Content-Disposition'], 'inline; filename="ergani.pdf"');
});

test('missing scoped employee returns 404 without update methods', async () => {
    let updateCalls = 0;
    const model = {
        findOne() {
            return {
                select() {
                    return {
                        async lean() {
                            return null;
                        }
                    };
                }
            };
        },
        findOneAndUpdate() {
            updateCalls++;
        },
        updateOne() {
            updateCalls++;
        }
    };
    const res = createResponse();

    const result = await requireScopedEmployeeForUpdate({
        req: {
            params: { ergazomenoiId: VALID_ID },
            session: { userTeam: 'team-a', companyInUse: 'company-a' }
        },
        res,
        model,
        objectId: { isValid: () => true }
    });

    assert.equal(result, null);
    assert.equal(res.statusCode, 404);
    assert.equal(updateCalls, 0);
});

test('valid employee lookup returns exact team/company update scope', async () => {
    let lookupFilter;
    let projection;
    const model = {
        findOne(filter) {
            lookupFilter = filter;
            return {
                select(value) {
                    projection = value;
                    return {
                        async lean() {
                            return { _id: VALID_ID, kodikos: '0001' };
                        }
                    };
                }
            };
        }
    };
    const res = createResponse();

    const result = await requireScopedEmployeeForUpdate({
        req: {
            params: { ergazomenoiId: VALID_ID },
            session: { userTeam: 'team-a', companyInUse: 'company-a' }
        },
        res,
        model,
        objectId: { isValid: () => true }
    });

    assert.deepEqual(lookupFilter, {
        _id: VALID_ID,
        team: 'team-a',
        company_kod: 'company-a'
    });
    assert.deepEqual(result.employeeScope, lookupFilter);
    assert.equal(result.employeeCode, '0001');
    assert.equal(projection, '_id kodikos');
});

test('employee scope query rejection returns sanitized 500 without updates', async () => {
    let updateCalls = 0;
    const logged = [];
    const model = {
        findOne() {
            return {
                select() {
                    return {
                        async lean() {
                            throw new Error('mongodb://user:secret@private-host/raw failure');
                        }
                    };
                }
            };
        },
        findOneAndUpdate() {
            updateCalls++;
        },
        updateOne() {
            updateCalls++;
        }
    };
    const res = createResponse();

    const result = await requireScopedEmployeeForUpdate({
        req: {
            params: { ergazomenoiId: VALID_ID },
            session: { userTeam: 'team-a', companyInUse: 'company-a' }
        },
        res,
        model,
        objectId: { isValid: () => true },
        logger: { error: (...args) => logged.push(args) }
    });

    assert.equal(result, null);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, {
        success: false,
        errorMessage: 'Σφάλμα κατά τον έλεγχο πρόσβασης στον εργαζόμενο'
    });
    assert.equal(JSON.stringify(res.body).includes('mongodb://'), false);
    assert.equal(updateCalls, 0);
    assert.deepEqual(logged[0][1], { category: 'Error' });
});

test('database employee code overrides malicious request identity', async () => {
    const model = {
        findOne() {
            return {
                select() {
                    return {
                        async lean() {
                            return { _id: VALID_ID, kodikos: '0001' };
                        }
                    };
                }
            };
        }
    };
    const res = createResponse();
    const req = {
        params: { ergazomenoiId: VALID_ID },
        session: { userTeam: 'team-a', companyInUse: 'company-a' },
        body: { formData: { kodikosHidden: '0002' } }
    };

    const result = await requireScopedEmployeeForUpdate({
        req,
        res,
        model,
        objectId: { isValid: () => true }
    });

    assert.equal(result.employeeCode, '0001');
    assert.notEqual(result.employeeCode, req.body.formData.kodikosHidden);
});

test('missing database employee code stops before history or update', async () => {
    let updateCalls = 0;
    const model = {
        findOne() {
            return {
                select() {
                    return {
                        async lean() {
                            return { _id: VALID_ID, kodikos: '   ' };
                        }
                    };
                }
            };
        },
        findOneAndUpdate() {
            updateCalls++;
        },
        updateOne() {
            updateCalls++;
        }
    };
    const res = createResponse();

    const result = await requireScopedEmployeeForUpdate({
        req: {
            params: { ergazomenoiId: VALID_ID },
            session: { userTeam: 'team-a', companyInUse: 'company-a' }
        },
        res,
        model,
        objectId: { isValid: () => true },
        logger: { error: () => {} }
    });

    assert.equal(result, null);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, {
        success: false,
        errorMessage: 'Σφάλμα ακεραιότητας δεδομένων εργαζομένου'
    });
    assert.equal(updateCalls, 0);
});
