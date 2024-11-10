const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Material = require('../models/materialModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const mime = require('mime-types');

// Set max file size to 40MB
const MAX_FILE_SIZE = 40 * 1024 * 1024;

// Configure upload directory
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

// Multer upload configuration
const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.size > MAX_FILE_SIZE) {
      cb(new AppError('File too large - max 40MB allowed', 400), false);
      return;
    }
    cb(null, true);
  },
}).single('file');

// Handle multer errors
const handleUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('File size exceeds 40MB limit', 400));
      }
      return next(new AppError(err.message, 400));
    }
    next();
  });
};

exports.uploadMaterial = handleUpload;

exports.createMaterial = catchAsync(async (req, res, next) => {
  const { course, type, parentPath } = req.body;
  let { name } = req.body;

  // Validate required fields
  if (!course || !type) {
    return next(new AppError('Missing required fields', 400));
  }

  // Trim whitespace
  let trimmedName = name ? name.trim() : '';
  const trimmedParentPath = parentPath ? parentPath.trim() : '';

  // Handle file requirements
  if (type === 'file') {
    if (!req.file) {
      return next(new AppError("File is required for type 'file'", 400));
    }

    // Use original filename if name not provided
    if (!trimmedName) {
      trimmedName = req.file.originalname;
    }

    // Add file extension if missing
    const fileExtension = path.extname(req.file.originalname);
    if (!path.extname(trimmedName)) {
      trimmedName += fileExtension;
    }
  }

  // Construct the material path using path.posix for consistent '/'
  const materialPath = trimmedParentPath
    ? path.posix.join(trimmedParentPath, trimmedName)
    : trimmedName;

  // Normalize the material path
  const normalizedMaterialPath = path.posix.normalize(materialPath);

  // Build the full path for the material
  const fullMaterialPath = path.join(uploadDir, ...normalizedMaterialPath.split('/'));

  // Ensure all parent folders exist in the database and file system
  const pathSegments = trimmedParentPath
    ? trimmedParentPath.split('/').filter(Boolean)
    : [];
  let parentFolderId = null;
  let currentPath = '';

  for (const segment of pathSegments) {
    currentPath = currentPath ? path.posix.join(currentPath, segment) : segment;

    // Normalize the current path
    const normalizedCurrentPath = path.posix.normalize(currentPath);

    // Check if the folder exists in the database
    const folder = await Material.findOne({
      course,
      path: normalizedCurrentPath,
      type: 'folder',
    });

    if (!folder) {
      return next(new AppError(`Folder ${segment} does not exist`, 400));
    }

    // Check if the folder exists in the file system
    const folderPath = path.join(uploadDir, ...normalizedCurrentPath.split('/'));
    if (!fs.existsSync(folderPath)) {
      return next(
        new AppError(
          `Folder ${segment} does not exist in the file system`,
          400
        )
      );
    }

    parentFolderId = folder._id;
  }

  // Create necessary directories in the file system
  const dirPath = path.dirname(fullMaterialPath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // Move/create file or folder
  if (type === 'file') {
    fs.renameSync(req.file.path, fullMaterialPath);
  } else {
    // For folders, create the directory
    if (!fs.existsSync(fullMaterialPath)) {
      fs.mkdirSync(fullMaterialPath, { recursive: true });
    }
  }

  // Prepare material data with all required fields
  const materialData = {
    course,
    name: trimmedName,
    type,
    path: normalizedMaterialPath,
    filePath: fullMaterialPath,
    parentFolder: parentFolderId,
  };

  // Add file metadata if it's a file
  if (type === 'file') {
    materialData.size = req.file.size;
    materialData.mimeType = req.file.mimetype;
  }

  // Create the Material document
  const material = await Material.create(materialData);

  res.status(201).json({
    status: 'success',
    data: { material },
  });
});

exports.getMaterials = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const { parentPath } = req.query;

  // Use path.posix for consistent '/'
  const normalizedParentPath = parentPath
    ? path.posix.normalize(parentPath.trim())
    : '';

  let query = { course: courseId };

  if (normalizedParentPath) {
    // Match only direct children of the parent path
    const escapedPath = normalizedParentPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query = {
      course: courseId,
      path: new RegExp(`^${escapedPath}/[^/]+$`)
    };
  } else {
    // Match only top-level files/folders
    query.path = {
      $regex: '^[^/]+$'
    };
  }

  const materials = await Material.find(query)
    .select('name type mimeType humanSize path filePath createdAt size parentFolder')
    .populate('parentFolder', 'name path')
    .sort({ type: -1, name: 1 });

  const transformedMaterials = materials.map(mat => ({
    ...mat.toObject(),
    path: mat.path.split(path.posix.sep).join('/'),
    filePath: mat.filePath.split(path.sep).join('/')
  }));

  res.status(200).json({
    status: 'success',
    data: {
      materials: transformedMaterials,
      parentPath: normalizedParentPath
    }
  });
});

exports.updateMaterial = catchAsync(async (req, res, next) => {
  const material = await Material.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  );

  if (!material) {
    return next(new AppError('No material found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: { material },
  });
});

exports.deleteMaterial = catchAsync(async (req, res, next) => {
  // First, find the material without deleting it
  const material = await Material.findById(req.params.id);

  if (!material) {
    return next(new AppError('No material found with that ID', 404));
  }

  if (material.type === 'folder') {
    // Prepare regex pattern to match all nested paths
    const normalizedPath = material.path.split(path.sep).join('/');
    const escapedPath = normalizedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nestedPattern = new RegExp(`^${escapedPath}(/|$)`);

    // Find all nested materials
    const nestedMaterials = await Material.find({
      course: material.course,
      path: nestedPattern
    });

    // Delete all nested materials from filesystem
    for (const nestedMaterial of nestedMaterials) {
      const nestedFilePath = path.join(uploadDir, ...nestedMaterial.path.split('/'));
      if (fs.existsSync(nestedFilePath)) {
        if (nestedMaterial.type === 'folder') {
          fs.rmSync(nestedFilePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(nestedFilePath);
        }
      }
    }

    // Delete all nested materials from database
    await Material.deleteMany({
      course: material.course,
      path: nestedPattern
    });
  }

  // Delete the material itself from filesystem
  const filePath = path.join(uploadDir, ...material.path.split('/'));
  if (fs.existsSync(filePath)) {
    if (material.type === 'folder') {
      fs.rmSync(filePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(filePath);
    }
  }

  // Delete the material from database
  await Material.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.getMaterialFile = catchAsync(async (req, res, next) => {
  const material = await Material.findById(req.params.id);

  if (!material || material.type !== 'file') {
    return next(new AppError('No file found with that ID', 404));
  }

  // Fix path resolution
  const relativePath = material.path.split('/').join(path.sep);
  const filePath = path.join(uploadDir, relativePath);

  if (!fs.existsSync(filePath)) {
    return next(new AppError(`File not found at path: ${filePath}`, 404));
  }

  // File type configurations
  const fileExtension = path.extname(material.name).toLowerCase();

  // Define MIME types for common file types
  const specialMimeTypes = {
    // Microsoft Office
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

    // Open Office
    '.odt': 'application/vnd.oasis.opendocument.text',
    '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
    '.odp': 'application/vnd.oasis.opendocument.presentation',

    // Other common types
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.txt': 'text/plain',
    '.csv': 'text/csv'
  };

  // Determine MIME type
  const mimeType = specialMimeTypes[fileExtension] ||
    mime.lookup(filePath) ||
    material.mimeType ||
    'application/octet-stream';

  // Define which files can be viewed in browser
  const viewableTypes = [
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp',
    // Documents
    '.pdf',
    // Text
    '.txt', '.csv', '.html', '.htm',
    // Video
    '.mp4', '.webm',
    // Audio
    '.mp3', '.wav'
  ];

  // Determine if file should be viewed in browser
  const isViewable = viewableTypes.includes(fileExtension) && !req.query.download;

  // Set headers
  const headers = {
    'Content-Type': mimeType,
    'Content-Length': material.size,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Content-Transfer-Encoding': 'binary',
    'Content-Disposition': `${isViewable ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(material.name)}`,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-XSS-Protection': '1; mode=block'
  };

  // Apply headers
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle range requests for media streaming
  if (req.headers.range && (mimeType.startsWith('video/') || mimeType.startsWith('audio/'))) {
    const parts = req.headers.range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : material.size - 1;

    res.status(206); // Partial Content
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Range', `bytes ${start}-${end}/${material.size}`);
    res.setHeader('Content-Length', end - start + 1);

    const stream = fs.createReadStream(filePath, { start, end });
    stream.on('error', error => {
      console.error('Stream error:', error);
      next(new AppError('Error streaming file', 500));
    });
    stream.pipe(res);
  } else {
    // Normal file streaming
    const stream = fs.createReadStream(filePath);
    stream.on('error', error => {
      console.error('Stream error:', error);
      next(new AppError('Error streaming file', 500));
    });
    stream.pipe(res);
  }
});