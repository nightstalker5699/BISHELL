# Notifications API Documentation

## Base URL
`/api/notifications`

## Endpoints

### Get All Notifications
- **URL**: `/`
- **Method**: `GET`
- **Authentication**: Required
- **Query Parameters**:
  - `page`: number (default: 1)
  - `limit`: number (default: 10)
  - `sort`: string (default: "-createdAt")
  - `group`: string (optional) - Filter by notification group:
    - `materials`
    - `announcements`
    - `comments`
    - `questions`
    - `social`
  - `isRead`: boolean (optional) - Filter by read status

**Response:**
```json
{
  "status": "success",
  "data": {
    "notifications": [
      {
        "id": "string",
        "type": "enum (like-question, comment-on-question, etc.)",
        "groupKey": "string (materials|announcements|comments|questions|social)",
        "title": "string",
        "message": "string",
        "link": "string (URL)",
        "isRead": "boolean",
        "actingUser": {
          "id": "string",
          "username": "string",
          "fullName": "string",
          "photo": "string (URL)",
          "userFrame": "string",
          "role": "string"
        },
        "metadata": {
          "questionId": "string (optional)",
          "commentId": "string (optional)",
          "announcementId": "string (optional)",
          "courseId": "string (optional)",
          "courseName": "string (optional)",
          "materialId": "string (optional)",
          "title": "string (optional)"
        },
        "createdAt": "date",
        "timeAgo": "string"
      }
    ],
    "pagination": {
      "currentPage": "number",
      "totalPages": "number",
      "hasMore": "boolean",
      "total": "number",
      "limit": "number"
    },
    "stats": {
      "unread": "number",
      "byGroup": {
        "materials": "number",
        "announcements": "number",
        "comments": "number",
        "questions": "number",
        "social": "number"
      }
    }
  }
}
```

### Get All Notifications Response Details

The response includes detailed statistics and groupings:

```json
{
  "status": "success",
  "data": {
    "notifications": [/* notification objects as shown above */],
    "pagination": {/* pagination object as shown above */},
    "stats": {
      "unread": "number (total unread notifications)",
      "byGroup": {
        "materials": "number (unread material notifications)",
        "announcements": "number (unread announcement notifications)",
        "comments": "number (unread comment notifications)",
        "questions": "number (unread question notifications)",
        "social": "number (unread social notifications)"
      }
    }
  }
}
```

### Notification Groups

Notifications are categorized into the following groups:

1. **materials** - Types:
   - `new-material`

2. **announcements** - Types:
   - `new-announcement`
   - `course-announcement`

3. **comments** - Types:
   - `comment-on-question`
   - `comment-replied`
   - `comment-like`

4. **questions** - Types:
   - `like-question`
   - `answer-verified`
   - `question-following`

5. **social** - Types:
   - `new-follower`

### Get Unread Count
- **URL**: `/unread-count`
- **Method**: `GET`
- **Authentication**: Required

**Response:**
```json
{
  "status": "success",
  "data": {
    "total": "number (total unread notifications)",
    "groups": {
      "materials": "number (unread material notifications)",
      "announcements": "number (unread announcements)",
      "comments": "number (unread comments, replies and likes)",
      "questions": "number (unread question likes, verifications and follows)",
      "social": "number (unread follower notifications)"
    },
    "byType": {
      "new-material": "number",
      "new-announcement": "number",
      "course-announcement": "number",
      "comment-on-question": "number",
      "comment-replied": "number",
      "comment-like": "number",
      "like-question": "number",
      "answer-verified": "number",
      "question-following": "number",
      "new-follower": "number"
    }
  }
}
```

### Get Unread Count Response Details

The unread count endpoint provides detailed breakdowns:

```json
{
  "status": "success",
  "data": {
    "total": "number (total unread notifications)",
    "groups": {
      "materials": "number (unread material notifications)",
      "announcements": "number (unread announcements)",
      "comments": "number (unread comments and replies)",
      "likes": "number (unread likes on questions and comments)",
      "followers": "number (unread follower notifications)"
    },
    "byType": {
      "new-material": "number",
      "new-announcement": "number",
      "course-announcement": "number",
      "comment-on-question": "number",
      "comment-replied": "number",
      "comment-like": "number",
      "like-question": "number",
      "answer-verified": "number",
      "question-following": "number",
      "new-follower": "number"
    }
  }
}
```

### Group Types Breakdown

1. **materials** includes:
   - `new-material`

2. **announcements** includes:
   - `new-announcement`
   - `course-announcement`

3. **comments** includes:
   - `comment-on-question`
   - `comment-replied`
   - `comment-like`

4. **questions** includes:
   - `like-question`
   - `answer-verified`
   - `question-following`

5. **social** includes:
   - `new-follower`

### Mark Notification as Read
- **URL**: `/:id/read`
- **Method**: `PATCH`
- **Authentication**: Required
- **URL Parameters**:
  - `id`: Notification ID

**Response:**
```json
204 No Content
```

### Mark All as Read
- **URL**: `/markAllRead`
- **Method**: `PATCH`
- **Authentication**: Required
- **Query Parameters**:
  - `group`: string (optional) - Mark all read for specific group

**Response:**
```json
{
  "status": "success",
  "message": "string (e.g., '5 notifications marked as read')",
  "data": {
    "stats": {
      "unread": "number",
      "byGroup": {
        "materials": "number",
        "announcements": "number",
        "comments": "number",
        "questions": "number",
        "social": "number"
      }
    }
  }
}
```

### Mark All as Read Response Details

When marking notifications as read, you get updated statistics:

```json
{
  "status": "success",
  "message": "string (e.g., '5 notifications marked as read')",
  "data": {
    "stats": {
      "unread": "number (remaining unread notifications)",
      "byGroup": {
        "materials": "number",
        "announcements": "number",
        "comments": "number",
        "questions": "number",
        "social": "number"
      }
    }
  }
}
```

### Delete Notification
- **URL**: `/:id`
- **Method**: `DELETE`
- **Authentication**: Required
- **URL Parameters**:
  - `id`: Notification ID

**Response:**
```json
{
  "status": "success",
  "data": null
}
```

### Create System Notification
- **URL**: `/`
- **Method**: `POST`
- **Authentication**: Required (Admin only)
- **Request Body**:
```json
{
  "userId": "string (required)",
  "title": "string (required)",
  "message": "string (required)",
  "type": "string (optional, defaults to 'info')",
  "link": "string (optional)",
  "metadata": {
    "actingUserId": "string (added automatically)",
    "otherMetadata": "any"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "notification": {
      "id": "string",
      "userId": "string",
      "title": "string",
      "message": "string",
      "type": "string",
      "link": "string",
      "metadata": "object",
      "createdAt": "date",
      "isRead": false
    }
  }
}
```

## Notification Types

Available notification types and their metadata requirements:

### Questions & Comments
- `like-question`: When someone likes a question
  - Required metadata: questionId, actingUserId, title
- `comment-on-question`: When someone comments on a question
  - Required metadata: questionId, commentId, actingUserId, title
- `question-following`: When someone you follow posts a question
  - Required metadata: questionId, actingUserId, title
- `answer-verified`: When your answer is marked as correct
  - Required metadata: questionId, actingUserId, title
- `comment-replied`: When someone replies to your comment
  - Required metadata: questionId, commentId, actingUserId, title
- `comment-like`: When someone likes your comment
  - Required metadata: questionId, commentId, actingUserId, title

### Social
- `new-follower`: When someone follows you
  - Required metadata: actingUserId

### Content
- `new-announcement`: General announcements
  - Required metadata: announcementId, actingUserId, title
- `course-announcement`: Course-specific announcements
  - Required metadata: courseId, courseName, announcementId, actingUserId, title
- `new-material`: New course material
  - Required metadata: courseId, courseName, materialId, actingUserId

## Error Responses

```json
{
  "status": "fail",
  "error": {
    "statusCode": "number",
    "status": "string",
    "message": "string"
  }
}
```

Common error codes:
- 400: Bad Request (invalid input)
- 401: Unauthorized (missing/invalid token)
- 404: Not Found (notification not found)
- 500: Server Error