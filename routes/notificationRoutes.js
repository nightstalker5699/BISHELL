const express = require('express');
const notificationController = require('../controllers/notificationController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(authController.protect);

router
  .route('/')
  .get(notificationController.getAllNotifications)
  .post(notificationController.createNotification);



router.patch('/:id/read', notificationController.markAsRead);
router.patch('/mark-all-read', notificationController.markAllAsRead);
router.get('/unread-count', notificationController.getUnreadCount);
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;