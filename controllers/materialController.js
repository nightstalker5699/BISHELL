const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Material = require('../models/materialModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { parentPath } = req.body;
    const trimmedParentPath = parentPath ? parentPath.trim() : '';
    const materialPath = trimmedParentPath;
    const folderPath = path.join(uploadDir, materialPath);

    try {
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      cb(null, folderPath);
    } catch (err) {
      cb(new AppError(`Failed to create directory: ${err.message}`, 500));
    }
  },
  filename: (req, file, cb) => {
    const fileName = req.body.name.trim();
    cb(null, fileName);
  },
});

const upload = multer({ storage });

exports.uploadMaterial = upload.single('file');

exports.createMaterial = catchAsync(async (req, res, next) => {
  const { course, name, type, parentPath } = req.body;

  // Trim whitespace and newline characters
  const trimmedName = name.trim();
  const trimmedParentPath = parentPath ? parentPath.trim() : '';

  // Construct the full material path
  const materialPath = trimmedParentPath ? `${trimmedParentPath}/${trimmedName}` : trimmedName;

  // **NEW**: Split the path into segments and handle folder creation
  const pathSegments = materialPath.split('/');
  let currentPath = '';
  for (let i = 0; i < pathSegments.length - (type === 'file' ? 1 : 0); i++) {
    currentPath = i === 0 ? pathSegments[i] : `${currentPath}/${pathSegments[i]}`;
    const folderName = pathSegments[i];

    // Check if the folder already exists in the database
    let folderMaterial = await Material.findOne({ course, path: currentPath });

    if (!folderMaterial) {
      // Create a new Material document for the folder
      folderMaterial = await Material.create({
        course,
        name: folderName,
        type: 'folder',
        path: currentPath,
        filePath: path.join(uploadDir, currentPath),
      });

      // Create the folder in the file system
      const folderPath = path.join(uploadDir, currentPath);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
    }
  }

  // Prepare material data for the file or folder being created
  const materialData = {
    course,
    name: trimmedName,
    type,
    path: materialPath,
  };

  // Handle file uploads
  if (req.file) {
    materialData.filePath = req.file.path;
  }

  // Create folder in the file system if it's a folder
  if (type === 'folder') {
    const folderPath = path.join(uploadDir, materialPath);

    try {
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
      materialData.filePath = folderPath;
    } catch (err) {
      return next(new AppError(`Failed to create directory: ${err.message}`, 500));
    }
  }

  // Create the Material document for the file or folder
  const material = await Material.create(materialData);

  res.status(201).json({
    status: 'success',
    data: { material },
  });
});

exports.getMaterials = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const { parentPath } = req.query;

  let pathRegex;
  if (parentPath) {
    pathRegex = `^${parentPath}/[^/]+$`;
  } else {
    pathRegex = '^[^/]+$';
  }

  const materials = await Material.find({
    course: courseId,
    path: { $regex: pathRegex },
  }).select('name type path filePath createdAt');

  res.status(200).json({
    status: 'success',
    data: { materials },
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
  const material = await Material.findByIdAndDelete(req.params.id);

  if (!material) {
    return next(new AppError('No material found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});