# BISHELL API Documentation

This document provides comprehensive documentation for the BISHELL API, with a focus on the real-time notification system.

## Table of Contents

1. [Authentication](#authentication)
2. [Socket.IO Real-time Communication](#socket-io-real-time-communication)
   - [Connection Setup](#connection-setup)
   - [Notification Events](#notification-events)
   - [Chat Events](#chat-events)
3. [REST API Endpoints](#rest-api-endpoints)
   - [Notifications](#notifications)
   - [Questions & Comments](#questions-comments)
4. [Frontend Integration Examples](#frontend-integration-examples)
5. [Troubleshooting](#troubleshooting)

## Authentication

All API endpoints and socket connections require authentication using JWT tokens.

### Token Authentication

- **For REST API**: Include the token in the Authorization header.
  ```
  Authorization: Bearer <your-jwt-token>
  ```

- **For Socket.IO**: Pass the token in the auth object during connection.
  ```javascript
  const socket = io(`${API_URL}/notifications`, {
    auth: { token: authToken }
  });
  ```

## Socket.IO Real-time Communication

### Connection Setup

#### Notification Socket

```javascript
import { io } from "socket.io-client";

// Create notification socket connection
const notificationSocket = io(`${API_BASE_URL}/notifications`, {
  auth: { token: authToken },
  transports: ["websocket"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});

// Connection event handling
notificationSocket.on("connect", () => {
  console.log("Connected to notification system");
});

notificationSocket.on("connect_error", (error) => {
  console.error("Notification connection error:", error.message);
});
```

#### Chat Socket

```javascript
// Connect to a chat room (course)
const chatSocket = io(`${API_BASE_URL}`, {
  auth: { token: authToken },
  query: { course: courseSlug || "general" }
});

chatSocket.on("connect", () => {
  console.log("Connected to chat system");
});
```

### Notification Events

#### Emitted by Server

| Event | Data | Description |
|-------|------|-------------|
| `new_notification` | `{ notification }` | Emitted when a new notification is created |
| `unread_count` | `{ count }` | Provides the current unread notification count |
| `notifications_loaded` | `{ notifications }` | Response to loadNotifications request |
| `error` | Error object | Emitted when an error occurs |

#### Emitted by Client

| Event | Data | Description |
|-------|------|-------------|
| `loadNotifications` | `page` (number) | Request notifications by page number |
| `markAsRead` | `notificationId` | Mark a specific notification as read |

### Chat Events

#### Emitted by Server

| Event | Data | Description |
|-------|------|-------------|
| `load` | Array of messages | Initial message load |
| `receivedMessage` | Message object | New message in the room |
| `deletedMessage` | Message ID | When a message is deleted |
| `updatedMessage` | Message object | When a message is updated |

#### Emitted by Client

| Event | Data | Description |
|-------|------|-------------|
| `loadMessages` | `page` (number) | Request more messages by page |
| `sendMessage` | Message content | Send a new message |
| `sendReply` | `{ content, replyTo }` | Send a reply to a message |
| `deleteMessage` | Message ID | Delete a message |
| `updateMessage` | `{ _id, content }` | Update a message |

## REST API Endpoints

### Notifications

#### Get All Notifications

- **URL**: `/api/notifications`
- **Method**: `GET`
- **Query Parameters**:
  - `page`: Page number for pagination (default: 1)
  - `limit`: Number of items per page (default: 10)
  - `group`: Filter by notification group (materials, announcements, comments, questions, social)
  - `isRead`: Filter by read status (true/false)
- **Response**: List of notifications with pagination
  ```json
  {
    "status": "success",
    "data": {
      "notifications": [...],
      "pagination": {
        "currentPage": 1,
        "totalPages": 5,
        "hasMore": true,
        "total": 48,
        "limit": 10
      },
      "stats": {
        "unread": 12,
        "byGroup": {
          "materials": 3,
          "announcements": 2,
          "comments": 4,
          "questions": 1,
          "social": 2
        }
      }
    }
  }
  ```

#### Mark Notification as Read

- **URL**: `/api/notifications/:id/read`
- **Method**: `PATCH`
- **Response**: Status 204 (No Content)

#### Mark All Notifications as Read

- **URL**: `/api/notifications/mark-all-read`
- **Method**: `PATCH`
- **Query Parameters**:
  - `group`: Optional group to mark as read
- **Response**: Updated unread counts

#### Get Unread Notification Count

- **URL**: `/api/notifications/unread-count`
- **Method**: `GET`
- **Response**:
  ```json
  {
    "status": "success",
    "data": {
      "total": 12,
      "groups": {
        "materials": 3,
        "announcements": 2,
        "comments": 4,
        "questions": 1,
        "social": 2
      },
      "byType": {
        "new-material": 3,
        "new-announcement": 1,
        "course-announcement": 1,
        "comment-on-question": 2,
        "comment-replied": 2,
        "like-question": 1,
        "new-follower": 2
      }
    }
  }
  ```

#### Delete All Notifications by Group

- **URL**: `/api/notifications/delete-group`
- **Method**: `DELETE`
- **Query Parameters**:
  - `group`: Notification group to delete
- **Response**: Updated notification counts

### Questions & Comments

*See separate API documentation for full details on these endpoints*

## Frontend Integration Examples

### Setting Up the Notification Bell

```jsx
import React, { useState, useEffect } from 'react';
import { io } from "socket.io-client";
import { Badge, Popover, List, Avatar } from 'your-ui-library';
import { BellIcon } from 'your-icons-library';

const NotificationBell = ({ authToken, apiBaseUrl }) => {
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Connect to notification socket
  useEffect(() => {
    if (!authToken) return;
    
    const notifSocket = io(`${apiBaseUrl}/notifications`, {
      auth: { token: authToken },
      transports: ["websocket"],
    });
    
    notifSocket.on("connect", () => {
      console.log("Connected to notification system");
      notifSocket.emit("loadNotifications", 1);
    });
    
    notifSocket.on("connect_error", (error) => {
      console.error("Notification connection error:", error);
    });
    
    notifSocket.on("notifications_loaded", ({ notifications }) => {
      setNotifications(notifications);
      setLoading(false);
    });
    
    notifSocket.on("new_notification", ({ notification }) => {
      // Play notification sound
      const audio = new Audio('/notification-sound.mp3');
      audio.play().catch(e => console.log('Sound play failed'));
      
      // Add to list
      setNotifications(prev => [notification, ...prev]);
      
      // Show browser notification if page is not active
      if (document.hidden && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message
        });
      }
    });
    
    notifSocket.on("unread_count", ({ count }) => {
      setUnreadCount(count);
      // Update favicon badge or document title if needed
      document.title = count > 0 ? `(${count}) BISHELL` : 'BISHELL';
    });
    
    setSocket(notifSocket);
    
    return () => {
      notifSocket.disconnect();
    };
  }, [authToken, apiBaseUrl]);
  
  // Mark notification as read
  const handleNotificationClick = (notification) => {
    if (!notification.isRead && socket) {
      socket.emit("markAsRead", notification.id);
      
      // Update UI optimistically
      setNotifications(prev => prev.map(n => 
        n.id === notification.id ? {...n, isRead: true} : n
      ));
    }
    
    // Navigate to the notification link
    if (notification.link) {
      window.location.href = notification.link;
    }
    
    // Close popover
    setIsOpen(false);
  };
  
  // Render notification bell with badge and popover
  return (
    <div className="notification-bell">
      <button 
        className="notification-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <BellIcon />
        {unreadCount > 0 && <Badge count={unreadCount} />}
      </button>
      
      <Popover
        open={isOpen}
        onClose={() => setIsOpen(false)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
      >
        <div className="notification-header">
          <h3>Notifications</h3>
          {unreadCount > 0 && (
            <button onClick={() => {
              if (socket) socket.emit("markAllAsRead");
            }}>
              Mark all as read
            </button>
          )}
        </div>
        
        <List className="notification-list">
          {loading ? (
            <div className="notification-loading">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="notification-empty">No notifications</div>
          ) : (
            notifications.map(notification => (
              <div 
                key={notification.id}
                className={`notification-item ${!notification.isRead ? 'unread' : ''}`}
                onClick={() => handleNotificationClick(notification)}
              >
                {notification.actingUser?.photo && (
                  <Avatar 
                    src={notification.actingUser.photo} 
                    alt={notification.actingUser.username}
                  />
                )}
                <div className="notification-content">
                  <div className="notification-title">{notification.title}</div>
                  <div className="notification-message">{notification.message}</div>
                  <div className="notification-time">
                    {new Date(notification.createdAt).toLocaleString()}
                  </div>
                </div>
                {!notification.isRead && <div className="unread-indicator" />}
              </div>
            ))
          )}
        </List>
      </Popover>
    </div>
  );
};

export default NotificationBell;
```

### Handling Push Notifications

For PWA/mobile applications, you'll need to handle Firebase Cloud Messaging push notifications in conjunction with Socket.IO notifications:

```javascript
// Initialize Firebase
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  // Your Firebase config
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Request permission and get token
async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: 'YOUR_VAPID_KEY'
      });
      
      // Send this token to your server
      await updateUserDeviceToken(token);
      
      return token;
    }
  } catch (error) {
    console.error('Notification permission error:', error);
  }
}

// Listen for messages when app is in foreground
onMessage(messaging, (payload) => {
  const { title, body, notificationId, type, click_action } = payload.data;
  
  // Show notification using browser API
  const notification = new Notification(title, {
    body: body,
    icon: '/logo.png'
  });
  
  notification.onclick = () => {
    window.open(click_action, '_blank');
    notification.close();
  };
});

// Function to update user's device token on the server
async function updateUserDeviceToken(token) {
  await fetch('/api/users/device-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ token })
  });
}

// Call this function when your app initializes
requestNotificationPermission();
```

## Notification Types

The system supports the following notification types:

| Type | Description | Example |
|------|-------------|---------|
| `like-question` | When someone likes your question | "John liked your question" |
| `comment-on-question` | When someone comments on your question | "Jane commented on your question" |
| `comment-replied` | When someone replies to your comment | "Mark replied to your comment" |
| `comment-like` | When someone likes your comment | "Sarah liked your comment" |
| `new-follower` | When someone follows you | "Alex started following you" |
| `mention` | When someone mentions you | "Lisa mentioned you in a question" |
| `new-announcement` | New general announcement | "New announcement: Course schedule updated" |
| `course-announcement` | New announcement in a course | "New announcement in Math101: Exam date" |
| `question-following` | When someone you follow posts a question | "David posted a new question" |
| `answer-verified` | When your answer is marked as correct | "Your answer was marked as correct" |
| `new-material` | When new material is added to a course | "New material 'Lecture 5' added in Physics101" |
