# Posts API Documentation

## Base URL
`/api/posts`

## Content Format
All post content should be sent using Quill editor format, which includes both delta and HTML representations.

## Endpoints

### Create Post
- **URL**: `/`
- **Method**: `POST`
- **Authentication**: Required
- **Content-Type**: `multipart/form-data`

**Request Body:**
```json
{
  "title": "string (5-100 characters)",
  "content": JSON.stringify({
    "delta": QuillDelta,
    "html": "HTML string with temporary image placeholders"
  }),
  "label": "enum ('Summary', 'Notes', 'Solutions', 'General')",
  "courseId": "string (optional)",
  "images": "File[] (optional, for attached images)",
  "embeddedImages": JSON.stringify([{
    "data": "base64 string or data URL",
    "placeholder": "temporary src used in HTML"
  }])
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "post": {
      "_id": "string",
      "title": "string",
      "content": {
        "delta": "QuillDelta object",
        "html": "string with processed image URLs"
      },
      "images": [{
        "filename": "string",
        "originalname": "string",
        "type": "string (embedded or attachment)",
        "url": "string"
      }],
      "userId": {
        "_id": "string",
        "username": "string",
        "photo": "string (URL)"
      },
      "label": "string",
      "courseId": "string (if provided)",
      "slug": "string",
      "views": "number",
      "likes": ["userId strings"],
      "isLiked": "boolean",
      "createdAt": "date",
      "updatedAt": "date"
    }
  }
}
```

### Update Post
- **URL**: `/:id`
- **Method**: `PATCH`
- **Authentication**: Required (must be post owner or admin)
- **Content-Type**: `multipart/form-data`

**Request Body:**
```json
{
  "title": "string (optional)",
  "content": JSON.stringify({
    "delta": QuillDelta,
    "html": "HTML string"
  }),
  "label": "string (optional)",
  "courseId": "string (optional)",
  "images": "File[] (optional, max 10 new images)"
}
```

**Response:** Same as Create Post

### Get Post by Username and Slug
- **URL**: `/:username/:slug`
- **Method**: `GET`
- **Authentication**: Optional

**Response:** Same as Create Post

### Get User Posts
- **URL**: `/user/:userId` or `/user/:userId/:courseName`
- **Method**: `GET`
- **Authentication**: Required
- **Query Parameters:**
  - `page`: number (default: 1)
  - `limit`: number (default: 10)

**Response:**
```json
{
  "status": "success",
  "data": {
    "posts": [Post objects],
    "currentPage": "number",
    "totalPages": "number",
    "total": "number"
  }
}
```

### Toggle Like
- **URL**: `/:id/toggle-like`
- **Method**: `POST`
- **Authentication**: Required

**Response:**
```json
{
  "status": "success",
  "data": {
    "post": "Post object"
  }
}
```

### Delete Post
- **URL**: `/:id`
- **Method**: `DELETE`
- **Authentication**: Required (must be post owner or admin)

**Behavior:**
- Deletes the post document from database
- Automatically removes all associated images from storage
- Cleans up any orphaned image files
- Removes associated comments

**Response:**
```json
{
  "status": "success",
  "data": null
}
```

## Image Handling
Posts can handle images in two ways:

1. **Embedded Images** (Within Quill Content):
   - Images pasted or inserted directly into the Quill editor
   - Send these as base64 data in the `embeddedImages` field
   - Each embedded image should have:
     ```json
     {
       "data": "base64 string or data URL",
       "placeholder": "temporary src used in HTML"
     }
     ```
   - The server will process these and replace placeholders with actual URLs

2. **Attached Images** (Separate from Content):
   - Files uploaded separately as attachments
   - Useful for downloadable images or galleries
   - Sent through the `images` field in FormData

**Technical Details:**
- Storage location: `/static/img/posts/`
- Limits:
  - Maximum 10 images total (embedded + attached)
  - Each image limited to 5MB
- Processing:
  - Resized to max 1200x1200 while maintaining aspect ratio
  - Converted to JPEG format
  - Compressed with 90% quality

## Image Processing Details
1. **Image Upload Limits**:
   - Maximum 10 images total per request (combined embedded + attached)
   - Each image limited to 5MB
   - Supported formats: JPEG, PNG, GIF (converted to JPEG)

2. **Image Processing**:
   - All images are automatically:
     - Resized to max 1200x1200 while maintaining aspect ratio
     - Converted to JPEG format
     - Compressed with 90% quality
     - Stored in `/static/img/posts/`

3. **Image Types**:
   - **Embedded Images** (from Quill editor):
     - Filename format: `post-{userId}-embedded-{timestamp}-{index}.jpeg`
     - Temporary URLs in HTML are automatically replaced with final URLs
   - **Attached Images** (separate uploads):
     - Filename format: `post-{userId}-{timestamp}-{index}.jpeg`
     - Original filenames are preserved in metadata

4. **Image URLs**:
   - Base URL: `{protocol}://{host}/img/posts/`
   - Full URL format: `{baseUrl}/{filename}`
   - URLs are automatically updated in Quill content HTML

## Frontend Implementation Notes

1. When creating/editing posts:
   - Use Quill editor to capture content
   - Convert content to both delta and HTML format
   - Send as stringified JSON in the content field
   - Handle images separately through the images field

2. Handling images:
   - Send images as FormData
   - Maximum 10 images per request
   - Images will be returned with URLs in the response

3. Example frontend code for creating a post:
```javascript
const createPost = async (postData, attachedImages = [], embeddedImages = []) => {
  const formData = new FormData();
  
  // Basic post data
  formData.append('title', postData.title);
  
  // Handle Quill content
  const contentToSend = {
    delta: postData.delta,
    html: postData.html // HTML with temporary image placeholders
  };
  formData.append('content', JSON.stringify(contentToSend));
  
  // Handle embedded images from Quill
  if (embeddedImages.length > 0) {
    formData.append('embeddedImages', JSON.stringify(embeddedImages));
  }
  
  // Handle attached images
  attachedImages.forEach(image => {
    formData.append('images', image);
  });

  if (postData.courseId) {
    formData.append('courseId', postData.courseId);
  }
  formData.append('label', postData.label);

  const response = await fetch('/api/posts', {
    method: 'POST',
    body: formData,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  return response.json();
};

// Example usage with Quill
const quillEditor = new Quill('#editor', {
  // ... your Quill config
});

quillEditor.getModule('toolbar').addHandler('image', () => {
  // Handle image insertion
  const input = document.createElement('input');
  input.setAttribute('type', 'file');
  input.setAttribute('accept', 'image/*');
  input.click();

  input.onchange = async () => {
    const file = input.files[0];
    if (file) {
      // Create a temporary URL for preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const tempUrl = e.target.result;
        // Insert temporary image in Quill
        const range = quillEditor.getSelection(true);
        quillEditor.insertEmbed(range.index, 'image', tempUrl);
        // Store image data for upload
        embeddedImages.push({
          data: tempUrl,
          placeholder: tempUrl
        });
      };
      reader.readAsDataURL(file);
    }
  };
});
```

## Additional Features

### Notifications
When a post is created, notifications are automatically sent to all followers:
- In-app notifications are created
- Push notifications are sent if users have registered device tokens
- Notification includes:
  - Title: "New Note"
  - Message: "{username} posted a new note: {noteTitle}"
  - Click action: "/note/{username}/{noteSlug}"

### Post Metadata
All post responses include:
- Full image URLs
- User profile photo URLs
- Like status for authenticated requests
- View count
- Comment information (when populated)

## Error Handling
All endpoints may return the following errors:
- 400: Bad Request (invalid input, missing required fields)
- 401: Unauthorized (missing/invalid token)
- 403: Forbidden (insufficient permissions)
- 404: Not Found (post/user/course not found)
- 413: Payload Too Large (image size exceeds 5MB)
- 415: Unsupported Media Type (invalid image format)
- 500: Server Error

## Best Practices
1. **Image Handling**:
   - Pre-process images client-side when possible to reduce upload size
   - Use appropriate image formats (JPEG for photos, PNG for graphics)
   - Consider lazy loading for embedded images
   - Cache images appropriately

2. **Content Management**:
   - Save drafts locally before submission
   - Implement retry logic for large uploads
   - Handle image upload failures gracefully
   - Validate content format before submission

3. **Performance**:
   - Paginate results using the provided limit/page parameters
   - Cache frequently accessed posts
   - Use appropriate image sizes for different contexts