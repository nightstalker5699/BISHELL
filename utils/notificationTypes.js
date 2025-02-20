const NotificationType = {
  // Questions & Comments
  LIKE_QUESTION: "like-question",
  COMMENT_ON_QUESTION: "comment-on-question",
  QUESTION_FOLLOWING: "question-following",
  ANSWER_VERIFIED: "answer-verified",
  COMMENT_REPLIED: "comment-replied",
  COMMENT_LIKED: "comment-like",
  
  // Social
  NEW_FOLLOWER: "new-follower",
  
  // Content
  NEW_ANNOUNCEMENT: "new-announcement",
  NEW_COURSE_ANNOUNCEMENT: "course-announcement",
  NEW_MATERIAL: "new-material",

  // Points & System
  POINTS_EARNED: "points-earned",
  POINTS_DEDUCTED: "points-deducted",
  INFO: "info"
};

const NotificationConfig = {
  [NotificationType.LIKE_QUESTION]: {
    title: "Question Liked",
    messageTemplate: "{username} liked your question",
    link: "/questions/{questionId}",
    metadataFields: ['questionId', 'actingUserId', 'title']
  },

  [NotificationType.COMMENT_ON_QUESTION]: {
    title: "New Comment",
    messageTemplate: "{username} commented on your question",
    link: "/questions/{questionId}",
    metadataFields: ['questionId', 'commentId', 'actingUserId', 'title']
  },

  [NotificationType.COMMENT_REPLIED]: {
    title: "New Reply",
    messageTemplate: "{username} replied to your comment",
    link: "/questions/{questionId}",
    metadataFields: ['questionId', 'commentId', 'actingUserId', 'title']
  },

  [NotificationType.COMMENT_LIKED]: {
    title: "Comment Liked",
    messageTemplate: "{username} liked your comment",
    link: "/questions/{questionId}",
    metadataFields: ['questionId', 'commentId', 'actingUserId', 'title']
  },

  [NotificationType.NEW_FOLLOWER]: {
    title: "New Follower",
    messageTemplate: "{username} started following you",
    link: "/profile/{username}",
    metadataFields: ['actingUserId']
  },

  [NotificationType.NEW_ANNOUNCEMENT]: {
    title: "New Announcement",
    messageTemplate: "New announcement: {title}",
    link: "/announcements/{announcementId}",
    metadataFields: ['announcementId', 'actingUserId', 'title']
  },
  
  [NotificationType.NEW_COURSE_ANNOUNCEMENT]: {
    title: "New Course Announcement",
    messageTemplate: "New announcement in {courseName}: {title}",
    link: "/courses/{courseId}/announcements/{announcementId}",
    metadataFields: ['courseId', 'courseName', 'announcementId', 'actingUserId', 'title']
  },

  [NotificationType.QUESTION_FOLLOWING]: {
    title: "New Question",
    messageTemplate: "{username} posted a new question",
    link: "/questions/{questionId}",
    metadataFields: ['questionId', 'actingUserId', 'title']
  },

  [NotificationType.ANSWER_VERIFIED]: {
    title: "Answer Verified",
    messageTemplate: "Your answer was marked as correct",
    link: "/questions/{questionId}",
    metadataFields: ['questionId', 'actingUserId', 'title']
  },

  [NotificationType.NEW_MATERIAL]: {
    title: "New Material",
    messageTemplate: "New material added to {courseName}",
    link: "/courses/{courseId}/materials",
    metadataFields: ['courseId', 'courseName', 'materialId', 'actingUserId']
  }
};

const formatNotificationMessage = (type, data) => {
  const config = NotificationConfig[type];
  if (!config) throw new Error(`Invalid notification type: ${type}`);

  let message = config.messageTemplate;
  let link = config.link;

  // Validate required metadata fields
  if (config.metadataFields) {
    const missingFields = config.metadataFields.filter(field => !data[field]);
    if (missingFields.length > 0) {
      console.warn(`Missing metadata fields for ${type}: ${missingFields.join(', ')}`);
    }
  }

  // Replace placeholders in message and link
  Object.keys(data).forEach((key) => {
    message = message.replace(`{${key}}`, data[key]);
    link = link.replace(`{${key}}`, data[key]);
  });

  return {
    title: config.title,
    body: message,
    click_action: link
  };
};

module.exports = {
  NotificationType,
  NotificationConfig,
  formatNotificationMessage,
};