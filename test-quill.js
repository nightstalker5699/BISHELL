const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Replace with your actual JWT token
const JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3NWQwMWQ2YTg0OGUxMzUzMGI4YmUxNCIsImlhdCI6MTczOTg5MTA0OSwiZXhwIjoxNzQ3NjY3MDQ5fQ.Z8YAMp_r5S_XatFVxmybzUS3SGFgknlMubBYcZH9yho';
const BASE_URL = 'http://localhost:8000/api';
const USERNAME = 'Nouralddin';

async function testQuillIntegration() {
    try {
        const timestamp = new Date().getTime();
        
        console.log('1. Reading test image...');
        const testImage = fs.readFileSync(path.join(__dirname, 'test-image.jpg'));
        const base64Image = testImage.toString('base64');

        const formData = new FormData();
        
        console.log('2. Preparing post data...');
        const title = `Test Quill Post ${timestamp}`;
        formData.append('title', title);
        formData.append('label', 'Notes');

        const quillContent = {
            delta: {
                ops: [
                    { insert: "Hello World with an embedded image:\n" },
                    { insert: { image: "temp_image_1" } },
                    { insert: "\nAnd some more text after the image." }
                ]
            },
            html: `<p>Hello World with an embedded image:</p><p><img src="temp_image_1"></p><p>And some more text after the image.</p>`
        };
        formData.append('content', JSON.stringify(quillContent));

        const embeddedImages = [{
            data: `data:image/jpeg;base64,${base64Image}`,
            placeholder: 'temp_image_1'
        }];
        formData.append('embeddedImages', JSON.stringify(embeddedImages));

        console.log('3. Adding attached image...');
        formData.append('images', testImage, 'attached-image.jpg');

        console.log(`4. Creating post with title: ${title}`);
        const response = await fetch(`${BASE_URL}/posts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${JWT_TOKEN}`
            },
            body: formData
        });

        const result = await response.json();
        console.log('Create response:', JSON.stringify(result, null, 2));

        if (result.status === 'success') {
            const { post } = result.data;
            console.log('\nPost details:');
            console.log('ID:', post._id);
            console.log('User ID:', typeof post.userId === 'object' ? post.userId._id : post.userId);
            console.log('Username:', USERNAME);
            console.log('Slug:', post.slug);
            console.log('Images:', JSON.stringify(post.images, null, 2));

            console.log('\n5. Getting post by username/slug...');
            console.log(`Fetching post with username: ${USERNAME}, slug: ${post.slug}`);
            const getResponse = await fetch(`${BASE_URL}/posts/${USERNAME}/${post.slug}`, {
                headers: {
                    'Authorization': `Bearer ${JWT_TOKEN}`
                }
            });
            const getResult = await getResponse.json();
            console.log('Retrieved post:', JSON.stringify(getResult, null, 2));

            if (getResult.status === 'success') {
                console.log('\n6. Updating post...');
                const updateFormData = new FormData();
                const updatedContent = {
                    delta: {
                        ops: [
                            { insert: "Updated content with the same image:\n" },
                            { insert: { image: post.images[0].url } },
                            { insert: "\nAnd updated text." }
                        ]
                    },
                    html: `<p>Updated content with the same image:</p><p><img src="${post.images[0].url}"></p><p>And updated text.</p>`
                };
                updateFormData.append('content', JSON.stringify(updatedContent));

                const updateResponse = await fetch(`${BASE_URL}/posts/${post._id}`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${JWT_TOKEN}`
                    },
                    body: updateFormData
                });
                const updateResult = await updateResponse.json();
                console.log('Update response:', JSON.stringify(updateResult, null, 2));
            }
        }

    } catch (error) {
        console.error('Test failed:', error.stack);
    }
}

console.log('Starting Quill integration test...');
testQuillIntegration().then(() => {
    console.log('Test completed!');
});