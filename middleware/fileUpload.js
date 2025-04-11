const multer = require('multer');
const path = require('path');

// Local storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); 
  },
  filename: (req, file, cb) => {
   
    cb(null, Date.now() + path.extname(file.originalname)); // Add file extension
  },
});

// Filter to allow only specific file types (e.g., PDFs, DOCX)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDFs and DOCX are allowed.'), false);
  }
};

// Setup Multer upload configuration
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // Set size limit (e.g., 10MB)
});

module.exports = upload;
