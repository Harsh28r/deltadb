require('dotenv').config();
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

async function listAllBuckets() {
  console.log('=================================');
  console.log('Listing all S3 Buckets...');
  console.log('=================================\n');

  const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  try {
    const command = new ListBucketsCommand({});
    const response = await s3Client.send(command);

    if (response.Buckets && response.Buckets.length > 0) {
      console.log(`✓ Found ${response.Buckets.length} bucket(s):\n`);
      response.Buckets.forEach((bucket, index) => {
        console.log(`${index + 1}. ${bucket.Name}`);
        console.log(`   Created: ${bucket.CreationDate}`);
      });
      console.log('\n✓ If any of these buckets is the one you want to use,');
      console.log('  update AWS_S3_BUCKET_NAME in your .env file');
    } else {
      console.log('No buckets found. You may need to create one first.');
    }
  } catch (error) {
    console.error('✗ Error listing buckets:', error.message);
    console.error('\nThis could mean:');
    console.error('1. Your IAM user lacks ListAllMyBuckets permission');
    console.error('2. Invalid AWS credentials');
    console.error('3. Network connectivity issues');
  }

  console.log('\n=================================');
}

listAllBuckets();
