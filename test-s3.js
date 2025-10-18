require('dotenv').config();
const s3Service = require('./services/s3Service');

async function testS3Connection() {
  console.log('=================================');
  console.log('Testing S3 Connection...');
  console.log('=================================\n');

  // Check environment variables
  console.log('Environment Variables:');
  console.log('- AWS_REGION:', process.env.AWS_REGION || 'NOT SET');
  console.log('- AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '✓ SET' : '✗ NOT SET');
  console.log('- AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '✓ SET' : '✗ NOT SET');
  console.log('- AWS_S3_BUCKET_NAME:', process.env.AWS_S3_BUCKET_NAME || 'NOT SET');
  console.log('\n');

  // Test 1: List files in bucket (to verify connection)
  try {
    console.log('Test 1: Listing files in S3 bucket...');
    const files = await s3Service.listFiles('', 10);
    console.log('✓ SUCCESS: S3 connection is working!');
    console.log(`Found ${files.length} files in the bucket\n`);

    if (files.length > 0) {
      console.log('First few files:');
      files.slice(0, 5).forEach(file => {
        console.log(`  - ${file.Key} (${(file.Size / 1024).toFixed(2)} KB)`);
      });
    } else {
      console.log('The bucket is empty (this is normal for a new bucket)');
    }
  } catch (error) {
    console.error('✗ FAILED: S3 connection test failed');
    console.error('Error:', error.message);
    console.error('\nPossible issues:');
    console.error('1. Invalid AWS credentials');
    console.error('2. Bucket name is incorrect');
    console.error('3. IAM user lacks S3 permissions');
    console.error('4. Region mismatch');
    console.error('5. Network connectivity issues\n');
    process.exit(1);
  }

  // Test 2: Check if bucket exists
  try {
    console.log('\nTest 2: Verifying bucket access...');
    await s3Service.listFiles('', 1);
    console.log('✓ SUCCESS: Bucket is accessible');
  } catch (error) {
    console.error('✗ FAILED: Cannot access bucket');
    console.error('Error:', error.message);
  }

  console.log('\n=================================');
  console.log('S3 Connection Test Complete!');
  console.log('=================================');
}

// Run the test
testS3Connection().catch(error => {
  console.error('\nUnexpected error:', error);
  process.exit(1);
});
