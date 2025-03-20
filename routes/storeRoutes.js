const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const storeController = require("../controllers/storeController");

router.use(authController.protect);

router
  .route("/")
  .post(authController.restrictTo("admin"), storeController.addItem)
  .get(storeController.getAllItem);

router.post("/buy/:id", storeController.buyItem);
router.get("/equip/:id", storeController.equipItem);
router.use(authController.restrictTo("admin"));
router
  .route("/:id")
  .patch(storeController.updateItem)
  .delete(storeController.deleteItem);

module.exports = router;
