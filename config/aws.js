const { S3Client } = require('@aws-sdk/client-s3');

// AWS S3 Configuration
const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
};

// Create S3 Client
const s3Client = new S3Client(awsConfig);

// S3 Bucket Configuration
const S3_CONFIG = {
  bucketName: process.env.AWS_S3_BUCKET_NAME,
  region: process.env.AWS_REGION || 'us-east-1',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ],
  folders: {
    channelPartners: 'channel-partners',
    cpSourcing: 'cp-sourcing',
    attendance: 'attendance/selfies',
    documents: 'documents',
    leads: 'leads'
  }
};

module.exports = {
  s3Client,
  S3_CONFIG,
  awsConfig
};
