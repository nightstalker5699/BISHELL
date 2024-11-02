const express = require("express");
const materialController = require("../controllers/materialController");

const router = express.Router();

router
  .route("/")
  .post(materialController.uploadMaterial, materialController.createMaterial)
  .get(materialController.getMaterials);

router
  .route("/:courseId")
  .get(materialController.getMaterials);

router
  .route("/:id")
  .patch(materialController.updateMaterial)
  .delete(materialController.deleteMaterial);

// Add download route
router
  .route("/download/:id")
  .get(materialController.getMaterialFile);

module.exports = router;