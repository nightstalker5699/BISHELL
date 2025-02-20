const express = require("express");
const materialController = require("../controllers/materialController");
const multer = require("multer");
const multiPartParser = multer();
const router = express.Router();
const authController = require("../controllers/authController");

router
  .route("/")
  .post(materialController.uploadMaterial, authController.protect,materialController.createMaterial)
  .get(materialController.getMaterials);

router.use(multiPartParser.any());
router.route("/:courseId").get(materialController.getMaterials);

router.route("/download/:id").get(materialController.getMaterialFile);

router.route('/download-folder/:id').get(materialController.downloadFolder);
router
  .route("/:id")
  .patch(materialController.updateMaterial)
  .delete(materialController.deleteMaterial);

module.exports = router;
