const fs = require("fs");
const path = require("path");
const multer = require("multer");
const Material = require("../models/materialModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

// Set max file size to 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Configure storage
const uploadDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

// Multer upload configuration
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    if (file.size > MAX_FILE_SIZE) {
      cb(new AppError("File too large - max 10MB allowed", 400), false);
      return;
    }
    cb(null, true);
  },
}).single("file");

// Handle multer errors
const handleUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return next(new AppError("File size exceeds 10MB limit", 400));
      }
      return next(new AppError(err.message, 400));
    }
    next();
  });
};

exports.uploadMaterial = handleUpload;

exports.createMaterial = catchAsync(async (req, res, next) => {
  const { course, name, type, parentPath } = req.body;

  // Validate required fields
  if (!course || !name || !type) {
    return next(new AppError("Missing required fields", 400));
  }

  // Trim whitespace
  let trimmedName = name.trim();
  const trimmedParentPath = parentPath ? parentPath.trim() : "";

  // Handle file extension for files
  if (type === "file") {
    if (!req.file) {
      return next(new AppError("File is required for type 'file'", 400));
    }

    // Get the file extension from the uploaded file
    const fileExtension = path.extname(req.file.originalname);

    // Check if the provided name has an extension
    if (!path.extname(trimmedName)) {
      trimmedName += fileExtension; // Append the original file's extension
    }
  }

  // Construct the material path
  const materialPath = trimmedParentPath
    ? path.join(trimmedParentPath, trimmedName)
    : trimmedName;

  // Normalize the material path
  const normalizedMaterialPath = path.normalize(materialPath);

  // Build the full path for the material
  const fullMaterialPath = path.join(uploadDir, normalizedMaterialPath);

  // Ensure all parent folders exist in the database and file system
  const pathSegments = (trimmedParentPath ? trimmedParentPath : "")
    .split(path.sep)
    .filter(Boolean);
  let parentFolderId = null;
  let currentPath = "";

  for (const segment of pathSegments) {
    currentPath = currentPath ? path.join(currentPath, segment) : segment;

    // Normalize the current path
    const normalizedCurrentPath = path.normalize(currentPath);

    // Check if the folder exists in the database
    let folder = await Material.findOne({
      course,
      path: normalizedCurrentPath,
      type: "folder",
    });

    if (!folder) {
      return next(new AppError(`Folder ${segment} does not exist`, 400));
    }

    // Check if the folder exists in the file system
    const folderPath = path.join(uploadDir, normalizedCurrentPath);
    if (!fs.existsSync(folderPath)) {
      return next(
        new AppError(`Folder ${segment} does not exist in the file system`, 400)
      );
    }

    parentFolderId = folder._id;
  }

  // Create necessary directories in the file system
  if (!fs.existsSync(path.dirname(fullMaterialPath))) {
    fs.mkdirSync(path.dirname(fullMaterialPath), { recursive: true });
  }

  // Move/create file or folder
  if (type === "file") {
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
    parentFolder: parentFolderId, // Keeping parent folder tracking
  };

  // Add file metadata if it's a file
  if (type === "file") {
    materialData.size = req.file.size;
    materialData.mimeType = req.file.mimetype;
  }

  // Create the Material document
  const material = await Material.create(materialData);

  res.status(201).json({
    status: "success",
    data: { material },
  });
});

exports.getMaterials = catchAsync(async (req, res, next) => {
  const { courseId } = req.params;
  const { parentPath } = req.query;

  const normalizedParentPath = parentPath ? path.normalize(parentPath.trim()).replace(/\//g, '\\') : "";

  const query = {
    course: courseId,
    path: normalizedParentPath ? {
      $regex: `^${normalizedParentPath.replace(/\\/g, '\\\\')}\\\\[^\\\\]*$`,
      $options: 'i'
    } : {
      $regex: `^[^\\\\]*$`,
      $options: 'i'
    }
  };

  const materials = await Material.find(query)
  .select("name type humanSize path filePath createdAt size parentFolder")
  .populate('parentFolder', 'name path')  // Add this line
  .sort({ name: 1 });

  const transformedMaterials = materials.map(mat => ({
    ...mat.toObject(), // This will now include virtuals
    path: mat.path.replace(/\\/g, '/'),
    filePath: mat.filePath.replace(/\\/g, '/')
  }));

  res.status(200).json({
    status: "success", 
    data: { materials: transformedMaterials },
  });
});

exports.updateMaterial = catchAsync(async (req, res, next) => {
  const material = await Material.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  if (!material) {
    return next(new AppError("No material found with that ID", 404));
  }

  res.status(200).json({
    status: "success",
    data: { material },
  });
});

exports.deleteMaterial = catchAsync(async (req, res, next) => {
  // First find the material without deleting it
  const material = await Material.findById(req.params.id);

  if (!material) {
    return next(new AppError("No material found with that ID", 404));
  }

  if (material.type === "folder") {
    // If it's a folder, find and delete all nested materials from database
    const nestedMaterialsPattern = `^${material.path.replace(
      /\\/g,
      "\\\\"
    )}\\\\`;
    await Material.deleteMany({
      course: material.course,
      path: {
        $regex: nestedMaterialsPattern,
        $options: "i",
      },
    });
  }

  // Delete the material itself from database
  await Material.findByIdAndDelete(req.params.id);

  // Delete from filesystem
  const filePath = path.resolve(material.filePath);
  if (fs.existsSync(filePath)) {
    // recursive: true will delete folder contents
    // force: true ignores errors
    fs.rmSync(filePath, { recursive: true, force: true });
  }

  res.status(204).json({
    status: "success",
    data: null,
  });
});

exports.getMaterialFile = catchAsync(async (req, res, next) => {
  const material = await Material.findById(req.params.id);

  if (!material || material.type !== "file") {
    return next(new AppError("No file found with that ID", 404));
  }

  const filePath = path.resolve(material.filePath);

  if (!fs.existsSync(filePath)) {
    return next(new AppError("File not found", 404));
  }

  // Set headers
  res.setHeader("Content-Type", material.mimeType);
  res.setHeader("Content-Length", material.size);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${material.name}"`
  );

  // Create read stream
  const stream = fs.createReadStream(filePath);

  // Handle stream errors
  stream.on("error", (error) => {
    next(new AppError("Error streaming file", 500));
  });

  // Pipe stream to response
  stream.pipe(res);
});
