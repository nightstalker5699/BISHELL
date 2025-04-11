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
  MENTION: "mention",
  
  // Content
  NEW_ANNOUNCEMENT: "new-announcement",
  NEW_COURSE_ANNOUNCEMENT: "course-announcement",
  NEW_MATERIAL: "new-material",

  // Points & System
  POINTS_EARNED: "points-earned",
  POINTS_DEDUCTED: "points-deducted",
  INFO: "info",
  
  // AI Assistant
  AI_EXPLANATION: "ai-explanation",


  // Assignment/Submission related notification types
  NEW_ASSIGNMENT: 'NEW_ASSIGNMENT',
  ASSIGNMENT_DEADLINE_EXTENDED: 'ASSIGNMENT_DEADLINE_EXTENDED',
  ASSIGNMENT_UPDATED: 'ASSIGNMENT_UPDATED',
  SUBMISSION_ACCEPTED: 'SUBMISSION_ACCEPTED',
  SUBMISSION_REJECTED: 'SUBMISSION_REJECTED',
  UPCOMING_DEADLINE_REMINDER: 'UPCOMING_DEADLINE_REMINDER',

  // notifications for instructors
  NEW_SUBMISSION: 'NEW_SUBMISSION',
  RESUBMISSION_BY_STUDENT: 'RESUBMISSION_BY_STUDENT',
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

  [NotificationType.MENTION]: {
    title: "New Mention",
    messageTemplate: {
      'question': "{username} mentioned you in a question",
      'question-comment': "{username} mentioned you in a question comment",
      'reply': "{username} mentioned you in a reply"
    },
    link: {
      'question': "/questions/{contentId}",
      'question-comment': "/questions/{questionId}",
      'reply': "/questions/{questionId}"
    },
    metadataFields: ['contentType', 'contentId', 'questionId', 'actingUserId', 'username']
  },
  
  [NotificationType.NEW_ANNOUNCEMENT]: {
    title: "New Announcement",
    messageTemplate: "New announcement: {title}",
    link: "/announcements",
    metadataFields: ['announcementId', 'actingUserId', 'title']
  },
  
  [NotificationType.NEW_COURSE_ANNOUNCEMENT]: {
    title: "New Course Announcement",
    messageTemplate: "New announcement in {courseName}: {title}",
    link: "/courses/{courseId}",
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
    title: "New Material Added",
    messageTemplate: "New material '{title}' added in {courseName}",
    link: "/courses/{courseId}/materials/{materialId}",
    metadataFields: ['courseId', 'courseName', 'materialId', 'actingUserId', 'title']
  },

  [NotificationType.AI_EXPLANATION]: {
    title: "AI Explanation",
    messageTemplate: "Elda7e7 has provided an explanation",
    link: "/questions/{questionId}",
    metadataFields: ['questionId', 'commentId']
  },

   // --- Assignments & Submissions ---

  [NotificationType.NEW_ASSIGNMENT]: {
    title: "New Assignment Posted",
    messageTemplate: "New assignment '{title}' has been posted in {courseName}",
    link: "/courses/{courseId}/assignments",
    metadataFields: ['courseId', 'courseName', 'title', 'actingUserId']
  },

  [NotificationType.ASSIGNMENT_DEADLINE_EXTENDED]: {
    title: "Assignment Deadline Extended",
    messageTemplate: "Deadline extended for assignment '{title}' in {courseName}",
    link: "/courses/{courseId}/assignments",
    metadataFields: ['courseId', 'courseName', 'title', 'actingUserId']
  },

  [NotificationType.ASSIGNMENT_UPDATED]: {
    title: "Assignment Updated",
    messageTemplate: "Assignment '{title}' was updated in {courseName}",
    link: "/courses/{courseId}/assignments",
    metadataFields: ['courseId', 'courseName', 'title', 'actingUserId']
  },

  [NotificationType.SUBMISSION_ACCEPTED]: {
    title: "Submission Accepted",
    messageTemplate: "Your submission for '{title}' in {courseName} was accepted!",
    link: "/courses/{courseId}/assignments",
    metadataFields: ['courseId', 'courseName', 'title', 'actingUserId']
  },

  [NotificationType.SUBMISSION_REJECTED]: {
    title: "Submission Rejected",
    messageTemplate: "Your submission for '{title}' in {courseName} was rejected. Please revise it.",
    link: "/courses/{courseId}/assignments",
    metadataFields: ['courseId', 'courseName', 'title', 'actingUserId']
  },

  [NotificationType.UPCOMING_DEADLINE_REMINDER]: {
    title: "Upcoming Assignment Deadline",
    messageTemplate: "Reminder: '{title}' in {courseName} is due soon!",
    link: "/courses/{courseId}/assignments",
    metadataFields: ['courseId', 'courseName', 'title']
  },

  // --- Instructor Notifications ---

  [NotificationType.NEW_SUBMISSION]: {
    title: "New Submission Received",
    messageTemplate: "{username} submitted '{title}' in {courseName}",
    link: "/courses/{courseId}/assignments",
    metadataFields: ['courseId', 'courseName', 'title', 'actingUserId', 'username']
  },

  [NotificationType.RESUBMISSION_BY_STUDENT]: {
    title: "Resubmission Received",
    messageTemplate: "{username} resubmitted '{title}' in {courseName}",
    link: "/courses/{courseId}/assignments",
    metadataFields: ['courseId', 'courseName', 'title', 'actingUserId', 'username']
  }
};

const formatNotificationMessage = (type, data) => {
  const config = NotificationConfig[type];
  if (!config) throw new Error(`Invalid notification type: ${type}`);

  // Handle message templates that are objects (like for mentions)
  let message = config.messageTemplate;
  let link = config.link;

  // Handle templated messages for different content types
  if (typeof message === 'object') {
    message = message[data.contentType] || message['default'] || `${config.title}`;
  }
  if (typeof link === 'object') {
    link = link[data.contentType] || link['default'] || '#';
  }

  // Validate required fields
  if (config.metadataFields) {
    const missingFields = config.metadataFields.filter(field => !data[field]);
    if (missingFields.length > 0) {
      console.warn(`Missing metadata fields for ${type}: ${missingFields.join(', ')}`);
    }
  }

  // Now message and link are guaranteed to be strings
  Object.keys(data).forEach((key) => {
    const value = data[key] || '';
    message = message.replace(new RegExp(`{${key}}`, 'g'), value);
    link = link.replace(new RegExp(`{${key}}`, 'g'), value);
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