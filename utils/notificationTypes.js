const NotificationType = {
  // Question related
  LIKE_QUESTION: "like-question",
  COMMENT_ON_QUESTION: "comment-on-question",
  COMMENT_REPLIED: "comment-replied",
  COMMENT_LIKED: "comment-like",
  ANSWER_VERIFIED: "answer-verified",
  QUESTION_FOLLOWING: "question-following",

  // User related
  NEW_FOLLOWER: "new-follower",

  // Content related
  NEW_NOTE: "new-note",
  NEW_ANNOUNCEMENT: "new-announcement",
  NEW_MATERIAL: "new-material",
  NEW_COURSE_ANNOUNCEMENT: "course-announcement",

  // Points related
  POINTS_EARNED: "points-earned",
  POINTS_DEDUCTED: "points-deducted",

  // Generic
  INFO: "info",
};

const NotificationConfig = {
  [NotificationType.LIKE_QUESTION]: {
    title: "New Like on Question",
    messageTemplate: "{username} liked your question",
    link: "/questions/{questionId}",
  },

  [NotificationType.COMMENT_ON_QUESTION]: {
    title: "New Comment",
    messageTemplate: "{username} commented on your question",
    link: "/questions/{questionId}",
  },

  [NotificationType.COMMENT_REPLIED]: {
    title: "New Reply",
    messageTemplate: "{username} replied to your comment",
    link: "/questions/{questionId}",
  },

  [NotificationType.QUESTION_FOLLOWING]: {
    title: "New Question from Followed User",
    messageTemplate: "{username} has posted a new question",
    link: "/questions/{questionId}",
  },

  [NotificationType.COMMENT_LIKED]: {
    title: "Comment Liked",
    messageTemplate: "{username} liked your comment",
    link: "/questions/{questionId}",
  },

  [NotificationType.ANSWER_VERIFIED]: {
    title: "Answer Verified",
    messageTemplate: "Your answer was marked as verified",
    link: "/questions/{questionId}",
  },

  [NotificationType.NEW_FOLLOWER]: {
    title: "New Follower",
    messageTemplate: "{username} started following you",
    link: "/profile/{username}",
  },

  [NotificationType.NEW_NOTE]: {
    title: "New Note",
    messageTemplate: "{username} posted a new note: {noteTitle}",
    link: "/note/{username}/{noteSlug}",
  },

  [NotificationType.NEW_ANNOUNCEMENT]: {
    title: "New Announcement",
    messageTemplate: "New announcement: {title}",
    link: "/announcements",
  },

  [NotificationType.NEW_COURSE_ANNOUNCEMENT]: {
    title: "{courseName} Announcement",
    messageTemplate: "New announcement in {courseName}: {title}",
    link: "/courses/{courseId}/announcements",
  },

  [NotificationType.NEW_MATERIAL]: {
    title: "New Material",
    messageTemplate: "New material added to {courseName}",
    link: "/courses/{courseId}/materials",
  },

  [NotificationType.POINTS_EARNED]: {
    title: "Points Earned",
    messageTemplate: "You earned {points} points: {reason}",
    link: "/profile/points",
  },

  [NotificationType.POINTS_DEDUCTED]: {
    title: "Points Deducted",
    messageTemplate: "{points} points were deducted: {reason}",
    link: "/profile/points",
  },

  [NotificationType.INFO]: {
    title: "Information",
    messageTemplate: "{message}",
    link: "{link}",
  },
};

// Helper function to format notification message
const formatNotificationMessage = (type, data) => {
  const config = NotificationConfig[type];
  if (!config) throw new Error(`Invalid notification type: ${type}`);

  let message = config.messageTemplate;
  let link = config.link;

  // Replace all placeholders in message and link
  Object.keys(data).forEach((key) => {
    message = message.replace(`{${key}}`, data[key]);
    link = link.replace(`{${key}}`, data[key]);
  });

  return {
    title: config.title.replace(/{(\w+)}/g, (match, key) => data[key] || match),
    body: message,
    click_action: link,
  };
};

module.exports = {
  NotificationType,
  NotificationConfig,
  formatNotificationMessage,
};
