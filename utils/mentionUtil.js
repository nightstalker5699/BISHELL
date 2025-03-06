const User = require('../models/userModel');
const { sendNotificationToUser } = require('./notificationUtil');
const { NotificationType } = require('./notificationTypes');

exports.processMentions = async (text, actingUserId, contentType, contentId, questionId = null) => {
  if (!text) return [];

  // Extract usernames from mentions (format: @username)
  const mentionRegex = /@([a-zA-Z0-9-]+)/g;
  const mentions = text.match(mentionRegex) || [];
  const usernames = mentions.map(mention => mention.substring(1));

  if (usernames.length === 0) return [];

  try {
    // Find mentioned users
    const mentionedUsers = await User.find({
      username: { $in: usernames }
    });

    // Send notifications to mentioned users
    const actingUser = await User.findById(actingUserId);
    const notificationPromises = mentionedUsers.map(user => {
      // Don't notify if user mentions themselves
      if (user._id.toString() === actingUserId.toString()) return null;

      return sendNotificationToUser(
        user._id,
        NotificationType.MENTION,
        {
          username: actingUser.username,
          actingUserId: actingUserId,
          contentType: contentType,
          contentId: contentId,
          questionId: questionId || contentId // For comments/replies, we need the question ID
        }
      );
    });

    await Promise.all(notificationPromises.filter(p => p !== null));

    return mentionedUsers.map(user => ({
      userId: user._id,
      username: user.username
    }));
  } catch (error) {
    console.error('Error processing mentions:', error);
    return [];
  }
};

exports.getUserSuggestions = async (query, limit = 5) => {
  try {
    const users = await User.find({
      username: { $regex: `^${query}`, $options: 'i' }
    })
    .select('username fullName photo role')
    .limit(limit);

    return users.map(user => ({
      id: user._id,
      username: user.username,
      fullName: user.fullName,
      photo: user.photo,
      role: user.role
    }));
  } catch (error) {
    console.error('Error getting user suggestions:', error);
    return [];
  }
};