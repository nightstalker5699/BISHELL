const express = require("express");
const materialController = require("../controllers/materialController");

const router = express.Router();

router
  .route("/")
  .post(materialController.uploadMaterial, materialController.createMaterial);

router
  .route("/:courseId")
  .get(materialController.getMaterials);

router
  .route("/:id")
  .patch(materialController.updateMaterial)
  .delete(materialController.deleteMaterial);

module.exports = router;