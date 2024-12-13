const admin = require('../firebase');

exports.sendNotification = async (req, res, next) => {
  const { tokens, title, body, data } = req.body;

  const message = {
    notification: {
      title,
      body,
    },
    data,
    tokens, // An array of device registration tokens
  };

  try {
    const response = await admin.messaging().sendMulticast(message);
    res.status(200).json({
      status: 'success',
      message: 'Notifications sent',
      response,
    });
  } catch (error) {
    next(error);
  }
};
// الملف ده للتجربة مش هنستخدمه غير في تجارب