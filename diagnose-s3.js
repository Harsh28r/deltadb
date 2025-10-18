require('dotenv').config();
const { S3Client, ListBucketsCommand, ListObjectsV2Command, HeadBucketCommand } = require('@aws-sdk/client-s3');

async function diagnoseS3Issues() {
  console.log('=================================');
  console.log('S3 Diagnosis Tool');
  console.log('=================================\n');

  // Check environment variables
  console.log('Environment Variables:');
  console.log('- AWS_REGION:', process.env.AWS_REGION || 'NOT SET');
  console.log('- AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? `✓ SET (${process.env.AWS_ACCESS_KEY_ID.substring(0, 8)}...)` : '✗ NOT SET');
  console.log('- AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '✓ SET (hidden)' : '✗ NOT SET');
  console.log('- AWS_S3_BUCKET_NAME:', process.env.AWS_S3_BUCKET_NAME || 'NOT SET');
  console.log('\n');

  const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });

  // Test 1: List all accessible buckets
  console.log('Test 1: Listing all accessible buckets...');
  try {
    const listBucketsCommand = new ListBucketsCommand({});
    const bucketsResponse = await s3Client.send(listBucketsCommand);

    if (bucketsResponse.Buckets && bucketsResponse.Buckets.length > 0) {
      console.log(`✓ Found ${bucketsResponse.Buckets.length} accessible buckets:`);
      bucketsResponse.Buckets.forEach(bucket => {
        console.log(`  - ${bucket.Name} (Created: ${bucket.CreationDate})`);
      });
      console.log('\n');
    } else {
      console.log('✗ No buckets found or no permission to list buckets\n');
    }
  } catch (error) {
    console.error('✗ Error listing buckets:', error.message);
    console.error('  This usually means your AWS credentials lack ListBuckets permission\n');
  }

  // Test 2: Check if the configured bucket exists
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  if (bucketName) {
    console.log(`Test 2: Checking configured bucket "${bucketName}"...`);
    try {
      const headBucketCommand = new HeadBucketCommand({ Bucket: bucketName });
      await s3Client.send(headBucketCommand);
      console.log('✓ Bucket exists and is accessible\n');
    } catch (error) {
      console.error(`✗ Cannot access bucket "${bucketName}"`);
      console.error('  Error:', error.name, '-', error.message);

      if (error.name === 'NoSuchBucket') {
        console.error('  → The bucket does not exist in this region');
        console.error('  → Check if the bucket name is correct');
        console.error('  → Verify the bucket exists in region:', process.env.AWS_REGION);
      } else if (error.name === 'AccessDenied' || error.$metadata?.httpStatusCode === 403) {
        console.error('  → Your IAM user/role lacks permission to access this bucket');
        console.error('  → Required permissions: s3:ListBucket, s3:GetObject, s3:PutObject');
      }
      console.log('\n');
    }

    // Test 3: Try to list objects in the configured bucket
    console.log(`Test 3: Trying to list objects in "${bucketName}"...`);
    try {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 5
      });
      const listResponse = await s3Client.send(listCommand);
      console.log(`✓ Successfully listed objects`);
      console.log(`  Found ${listResponse.KeyCount || 0} objects (showing max 5)`);

      if (listResponse.Contents && listResponse.Contents.length > 0) {
        console.log('  First few objects:');
        listResponse.Contents.forEach(obj => {
          console.log(`    - ${obj.Key} (${(obj.Size / 1024).toFixed(2)} KB)`);
        });
      }
      console.log('\n');
    } catch (error) {
      console.error(`✗ Cannot list objects in bucket`);
      console.error('  Error:', error.name, '-', error.message);
      console.log('\n');
    }
  }

  // Test 4: Check bucket type
  if (bucketName && bucketName.includes('--') && bucketName.includes('--x-s3')) {
    console.log('⚠ IMPORTANT: Detected S3 Express One Zone bucket format');
    console.log('  Your bucket appears to be an S3 Directory Bucket (S3 Express One Zone)');
    console.log('  These buckets require different configuration:');
    console.log('  1. Different endpoint format');
    console.log('  2. Session-based authentication');
    console.log('  3. Different IAM permissions');
    console.log('  4. Region-specific access patterns');
    console.log('\n  Recommendation: Use a standard S3 bucket instead, or update your');
    console.log('  AWS SDK configuration to support S3 Express One Zone.\n');
  }

  console.log('=================================');
  console.log('Diagnosis Complete');
  console.log('=================================');
}

diagnoseS3Issues().catch(error => {
  console.error('\nUnexpected error:', error);
  process.exit(1);
});
