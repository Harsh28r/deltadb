const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads', 'attendance', 'selfies');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage for selfies
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename: userId_timestamp_type.ext
    const userId = req.user?._id || req.user?.id || 'unknown';
    const timestamp = Date.now();
    const type = req.body.type || 'checkin'; // checkin or checkout
    const ext = path.extname(file.originalname);
    const filename = `${userId}_${timestamp}_${type}${ext}`;
    cb(null, filename);
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'), false);
  }
};

// Configure multer with limits
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max file size
  }
});

// Middleware for single selfie upload
const uploadSelfie = upload.single('selfie');

// Error handling middleware
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File too large. Maximum size is 10MB.',
        error: err.message
      });
    }
    return res.status(400).json({
      message: 'File upload error',
      error: err.message
    });
  } else if (err) {
    return res.status(400).json({
      message: err.message || 'Unknown upload error'
    });
  }
  // No error, continue to next middleware
  next();
};

module.exports = {
  uploadSelfie,
  handleUploadError,
  uploadDir
};
