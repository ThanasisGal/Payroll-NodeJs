'use strict';

function getScopedErganiLogFilter({ id, sessionTeam, companyId }) {
    return {
        _id: id,
        team: sessionTeam,
        $or: [{ companykod_object: companyId }, { companykod: String(companyId) }]
    };
}

function createOpenErganiPdfHandler({
    model,
    objectId,
    s3Client,
    GetObjectCommand,
    getBucket,
    logger = console
}) {
    return async function openErganiPdf(req, res) {
        try {
            const sessionTeam = req.session?.userTeam;
            const companyId = req.session?.companyInUse;
            const { id } = req.params || {};

            if (!sessionTeam || !companyId || !id || !objectId.isValid(String(id))) {
                return res.status(404).send('PDF not found');
            }

            const rec = await model
                .findOne(getScopedErganiLogFilter({ id, sessionTeam, companyId }))
                .lean();

            if (!rec) {
                return res.status(404).send('PDF not found');
            }

            const localMockUrl = rec.pdf_relative_path
                ? `/uploads/s3-mock/${rec.pdf_relative_path}`
                : '';

            if (rec.pdf_s3_url?.startsWith('file://')) {
                if (localMockUrl) return res.redirect(localMockUrl);
                return res.status(404).send('PDF local path not found');
            }

            if (!rec.pdf_s3_key) {
                if (localMockUrl) return res.redirect(localMockUrl);
                return res.status(404).send('PDF S3 key not found');
            }

            const bucket = getBucket(rec);
            if (!bucket) {
                if (localMockUrl) return res.redirect(localMockUrl);
                return res.status(500).send('PDF bucket not configured');
            }

            const s3Response = await s3Client.send(
                new GetObjectCommand({
                    Bucket: bucket,
                    Key: rec.pdf_s3_key
                })
            );

            res.removeHeader('X-Frame-Options');
            res.setHeader('X-Frame-Options', 'SAMEORIGIN');
            res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
            res.setHeader('Content-Type', s3Response.ContentType || 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="ergani.pdf"');
            res.setHeader('Cache-Control', 'private, max-age=300');

            if (s3Response.ContentLength) {
                res.setHeader('Content-Length', String(s3Response.ContentLength));
            }

            return s3Response.Body.pipe(res);
        } catch (error) {
            logger.error('openErganiPdf error', {
                logId: req.params?.id || null,
                category: error?.name || 'S3_READ_FAILED'
            });
            return res.status(500).send('PDF open error');
        }
    };
}

module.exports = {
    getScopedErganiLogFilter,
    createOpenErganiPdfHandler
};
