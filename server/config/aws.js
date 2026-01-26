// server/config/aws.js

const { S3Client } = require('@aws-sdk/client-s3');

// =========================================================================
// ENVIRONMENT VARIABLES
// =========================================================================

const AWS_REGION = process.env.AWS_REGION || 'eu-central-1';
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || 'payroll-s3-uploader';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

// =========================================================================
// DETERMINE AUTHENTICATION METHOD
// =========================================================================

let authMethod = 'Unknown';

if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
    authMethod = 'Explicit Credentials (.env)';
    console.log('🔑 AWS Authentication: Explicit Credentials from .env');
    console.log('   ⚠️  NOT recommended for production - use IAM Role instead');
} else {
    authMethod = 'IAM Role (EC2 Instance Profile)';
    console.log('🔐 AWS Authentication: IAM Role (EC2 Instance Profile)');
    console.log('   ✅ This is secure and recommended for production!');
}

console.log(`   Region: ${AWS_REGION}`);
console.log(`   Bucket: ${S3_BUCKET_NAME}`);
console.log(`   Auth Method: ${authMethod}\n`);

// =========================================================================
// CREATE S3 CLIENT
// =========================================================================

const s3ClientConfig = {
    region: AWS_REGION,
};

// Only add explicit credentials if provided (for local development)
if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
    s3ClientConfig.credentials = {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY,
    };
}
// Otherwise, AWS SDK automatically uses EC2 IAM Role

const s3Client = new S3Client(s3ClientConfig);

// =========================================================================
// EXPORTS
// =========================================================================

module.exports = {
    s3Client,
    S3_BUCKET_NAME,
    AWS_REGION,
};