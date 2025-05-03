const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const storeController = require("../controllers/storeController");
const multiPartParser = require("multer")();
router.use(authController.protect);
router.use(multiPartParser.any());
router
  .route("/")
  .post(authController.restrictTo("admin"), storeController.addItem)
  .get(storeController.getAllItem);

router.get("/equipped-frame", storeController.getEquippedFrame);
router.get("/owned-frames", storeController.getOwnedFrames);
router.post("/buy/:id", storeController.buyItem);
router.get("/equip/:id", storeController.equipItem);

router.use(authController.restrictTo("admin"));
router
  .route("/:id")
  .patch(storeController.updateItem)
  .delete(storeController.deleteItem);

module.exports = router;
