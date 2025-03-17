# Badges System Documentation

## Overview

The badges system recognizes user achievements based on their ranking and contribution to the platform. Badges are displayed next to usernames throughout the application, particularly in questions, comments, and user profiles.

## Badge Types

The system supports four badge ranks:

1. **Mighty Badge**: For top 3 ranked users
2. **Gold Badge**: For users in the top 10% (excluding top 3)
3. **Silver Badge**: For users in the top 10-50%
4. **Bronze Badge**: For users below the top 50%

## Badge Model Structure

The Badge model contains the following fields:

```javascript
{
  name: String,        // Display name of the badge
  description: String, // Explanation of how to earn the badge
  icon: String,        // Image file name for the badge icon
  criteria: String,    // Criteria for earning this badge
  rank: String,        // One of: "mighty", "gold", "silver", "bronze"
  createdAt: Date      // When the badge was created
}
```

## API Endpoints for Badges

### Badge Management (Admin Only)

- `GET /api/v1/badges` - List all badges
- `POST /api/v1/badges` - Create a new badge
- `GET /api/v1/badges/:id` - Get a single badge
- `PATCH /api/v1/badges/:id` - Update a badge
- `DELETE /api/v1/badges/:id` - Delete a badge
- `POST /api/v1/badges/assign` - Assign badges to all users based on ranking

### Public Endpoints

- `GET /api/v1/badges/user/:userId` - Get badges for a specific user

## Badge Data in API Responses

Badges are automatically populated in user objects across the API. Here's how badge data appears in various API responses:



### Questions List

When fetching questions via `GET /api/v1/questions`, each question includes the author's badges:

```json
{
  "questions": [
    {
      "id": "60d21b4667d0d8992e610c86",
      "content": "How do I solve this problem?",
      "user": {
        "username": "john_doe",
        "fullName": "John Doe",
        "photo": "user-john_doe.jpeg",
        "role": "student",
        "userFrame": "null",
        "badges": [
          {
            "_id": "60d21b4667d0d8992e610c85",
            "name": "Gold Badge",
            "icon": "gold-badge.png"
          }
        ]
      },
      // ...other question fields
    }
  ]
}
```

### Question Details

When viewing a single question via `GET /api/v1/questions/:id`, badges are included for:

1. The question author
2. Comment authors 
3. Reply authors
4. Verified answer author

```json
{
  "question": {
    "id": "60d21b4667d0d8992e610c86",
    "content": "How do I solve this problem?",
    "user": {
      "username": "john_doe",
      "fullName": "John Doe",
      "photo": "user-john_doe.jpeg",
      "role": "student",
      "userFrame": "null",
      "badges": [
        {
          "_id": "60d21b4667d0d8992e610c85",
          "name": "Gold Badge",
          "icon": "gold-badge.png"
        }
      ]
    },
    // ...other question fields
    "comments": {
      "data": [
        {
          "id": "60d21b4667d0d8992e610c87",
          "content": "I think you should try this approach...",
          "user": {
            "username": "expert_user",
            "fullName": "Expert User",
            "photo": "user-expert_user.jpeg",
            "role": "student",
            "userFrame": "null",
            "badges": [
              {
                "_id": "60d21b4667d0d8992e610c88",
                "name": "Mighty Badge",
                "icon": "mighty-badge.png"
              }
            ]
          },
          "replies": [
            {
              "id": "60d21b4667d0d8992e610c89",
              "content": "Thanks for your help!",
              "user": {
                "username": "john_doe",
                "fullName": "John Doe",
                "photo": "user-john_doe.jpeg",
                "role": "student",
                "userFrame": "null",
                "badges": [
                  {
                    "_id": "60d21b4667d0d8992e610c85",
                    "name": "Gold Badge",
                    "icon": "gold-badge.png"
                  }
                ]
              }
              // ...other reply fields
            }
          ]
          // ...other comment fields
        }
      ]
    }
  }
}
```

## Frontend Implementation Guidelines

### Displaying Badges

1. **Question List**: Display the author's primary badge next to their name
2. **Question Detail**: Show badges for the question author, commenters, and repliers next to their names








## Updating User Badges

The badge assignment is performed by the admin through the `POST /api/v1/badges/assign` endpoint. This automatically:

1. Sorts all students by points
2. Identifies the top 3, top 10%, and top 50% users
3. Assigns the appropriate badges to each user
4. Saves the changes to the database

