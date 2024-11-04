const express = require("express");
const materialController = require("../controllers/materialController");
const multer = require("multer");
const multiPartParser = multer();
const router = express.Router();

router
  .route("/")
  .post(materialController.uploadMaterial, materialController.createMaterial)
  .get(materialController.getMaterials);

router.use(multiPartParser.any());
router.route("/:courseId").get(materialController.getMaterials);

// Add specific download route
router.route("/download/:id").get(materialController.getMaterialFile);

router
  .route("/:id")
  .patch(materialController.updateMaterial)
  .delete(materialController.deleteMaterial);

module.exports = router;
