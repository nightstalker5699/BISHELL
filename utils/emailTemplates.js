const generatePasswordResetEmail = (resetURL) => {
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Forgot your password? Click the button below to reset it:</p>
        <a href="${resetURL}" style="display: inline-block; padding: 10px 20px; margin: 10px 0; font-size: 16px; color: #fff; background-color: #007bff; text-decoration: none; border-radius: 5px;">Reset Password</a>
        <p>If you didn't forget your password, please ignore this email.</p>
        <p>Thank you,<br>The BISHELL Team</p>
      </div>
    `;
  };
  
  module.exports = generatePasswordResetEmail;