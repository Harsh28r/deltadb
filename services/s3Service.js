const {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Upload } = require('@aws-sdk/lib-storage');
const { s3Client, S3_CONFIG } = require('../config/aws');
const path = require('path');
const crypto = require('crypto');

class S3Service {
  constructor() {
    this.client = s3Client;
    this.bucketName = S3_CONFIG.bucketName;
  }

  /**
   * Generate unique file key with folder structure
   * @param {string} folder - Folder name in S3
   * @param {string} originalFilename - Original file name
   * @param {string} userId - User ID for organizing files
   * @returns {string} - Generated S3 key
   */
  generateFileKey(folder, originalFilename, userId = null) {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, ext).replace(/[^a-zA-Z0-9]/g, '-');

    if (userId) {
      return `${folder}/${userId}/${timestamp}-${randomString}-${baseName}${ext}`;
    }
    return `${folder}/${timestamp}-${randomString}-${baseName}${ext}`;
  }

  /**
   * Upload file to S3
   * @param {Buffer|Stream} fileBuffer - File buffer or stream
   * @param {string} key - S3 key (file path)
   * @param {string} contentType - MIME type
   * @param {object} metadata - Optional metadata
   * @returns {Promise<object>} - Upload result
   */
  async uploadFile(fileBuffer, key, contentType, metadata = {}) {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        Metadata: metadata,
        ServerSideEncryption: 'AES256'
      });

      const response = await this.client.send(command);

      return {
        success: true,
        key: key,
        location: `https://${this.bucketName}.s3.${S3_CONFIG.region}.amazonaws.com/${key}`,
        etag: response.ETag,
        bucket: this.bucketName
      };
    } catch (error) {
      console.error('S3 Upload Error:', error);
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  /**
   * Upload large file with multipart upload
   * @param {Stream} fileStream - File stream
   * @param {string} key - S3 key
   * @param {string} contentType - MIME type
   * @returns {Promise<object>} - Upload result
   */
  async uploadLargeFile(fileStream, key, contentType) {
    try {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucketName,
          Key: key,
          Body: fileStream,
          ContentType: contentType,
          ServerSideEncryption: 'AES256'
        },
        queueSize: 4, // concurrent uploads
        partSize: 5 * 1024 * 1024 // 5MB parts
      });

      const response = await upload.done();

      return {
        success: true,
        key: key,
        location: response.Location,
        etag: response.ETag,
        bucket: this.bucketName
      };
    } catch (error) {
      console.error('S3 Large Upload Error:', error);
      throw new Error(`Failed to upload large file: ${error.message}`);
    }
  }

  /**
   * Get file from S3
   * @param {string} key - S3 key
   * @returns {Promise<Stream>} - File stream
   */
  async getFile(key) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.client.send(command);
      return response.Body;
    } catch (error) {
      console.error('S3 Get File Error:', error);
      throw new Error(`Failed to get file from S3: ${error.message}`);
    }
  }

  /**
   * Generate pre-signed URL for temporary file access
   * @param {string} key - S3 key
   * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
   * @returns {Promise<string>} - Pre-signed URL
   */
  async getSignedUrl(key, expiresIn = 3600) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const signedUrl = await getSignedUrl(this.client, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      console.error('S3 Signed URL Error:', error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  }

  /**
   * Delete file from S3
   * @param {string} key - S3 key
   * @returns {Promise<boolean>} - Deletion success
   */
  async deleteFile(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('S3 Delete Error:', error);
      throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
  }

  /**
   * Delete multiple files from S3
   * @param {string[]} keys - Array of S3 keys
   * @returns {Promise<object>} - Deletion results
   */
  async deleteMultipleFiles(keys) {
    try {
      const results = await Promise.allSettled(
        keys.map(key => this.deleteFile(key))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return {
        success: failed === 0,
        successful,
        failed,
        total: keys.length
      };
    } catch (error) {
      console.error('S3 Bulk Delete Error:', error);
      throw new Error(`Failed to delete files: ${error.message}`);
    }
  }

  /**
   * List files in a folder
   * @param {string} prefix - Folder prefix
   * @param {number} maxKeys - Maximum number of keys to return
   * @returns {Promise<Array>} - List of files
   */
  async listFiles(prefix, maxKeys = 100) {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys
      });

      const response = await this.client.send(command);

      return response.Contents || [];
    } catch (error) {
      console.error('S3 List Files Error:', error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Check if file exists in S3
   * @param {string} key - S3 key
   * @returns {Promise<boolean>} - File exists
   */
  async fileExists(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata
   * @param {string} key - S3 key
   * @returns {Promise<object>} - File metadata
   */
  async getFileMetadata(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      const response = await this.client.send(command);

      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        etag: response.ETag,
        metadata: response.Metadata
      };
    } catch (error) {
      console.error('S3 Get Metadata Error:', error);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  /**
   * Copy file within S3
   * @param {string} sourceKey - Source S3 key
   * @param {string} destinationKey - Destination S3 key
   * @returns {Promise<boolean>} - Copy success
   */
  async copyFile(sourceKey, destinationKey) {
    try {
      const { CopyObjectCommand } = require('@aws-sdk/client-s3');

      const command = new CopyObjectCommand({
        Bucket: this.bucketName,
        CopySource: `${this.bucketName}/${sourceKey}`,
        Key: destinationKey
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('S3 Copy Error:', error);
      throw new Error(`Failed to copy file: ${error.message}`);
    }
  }
}

// Create singleton instance
const s3Service = new S3Service();

module.exports = s3Service;
