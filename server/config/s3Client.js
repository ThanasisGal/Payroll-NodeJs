const { S3Client } = require('@aws-sdk/client-s3');

// ✅ Χωρίς credentials - χρησιμοποιεί IAM Role
const s3Client = new S3Client({
  region: process.env. AWS_REGION || 'eu-central-1'
});

module.exports = s3Client;