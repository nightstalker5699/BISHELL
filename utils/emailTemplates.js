const generatePasswordResetEmail = (resetURL) => {
    // return `
    //   <div style="font-family: Arial, sans-serif; line-height: 1.6;">
    //     <h2 style="color: #333;">Password Reset Request</h2>
    //     <p>Forgot your password? Click the button below to reset it:</p>
    //     <a href="${resetURL}" style="display: inline-block; padding: 10px 20px; margin: 10px 0; font-size: 16px; color: #fff; background-color: #007bff; text-decoration: none; border-radius: 5px;">Reset Password</a>
    //     <p>If you didn't forget your password, please ignore this email.</p>
    //     <p>Thank you,<br>The BISHELL Team</p>
    //   </div>
    // `;

    return `
     <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; padding: 30px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden;">
          <div style="padding: 30px;">
            <h2 style="color: #2c3e50; font-size: 24px; margin-bottom: 20px;">🔐 Password Reset Request</h2>
            <p style="color: #555; font-size: 16px;">You recently requested to reset your password. Click the button below to proceed:</p>
        
            <div style="text-align: center; margin: 30px 0;">
            <a href="${resetURL}" style="display: inline-block; padding: 12px 24px; font-size: 16px; color: #fff; background-color: #007bff; text-decoration: none; border-radius: 6px;">Reset Password</a>
            </div>

            <p style="color: #888; font-size: 14px;">If you did not request a password reset, no action is needed. Your password will remain unchanged.</p>
        
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />

            <p style="color: #333; font-size: 14px;">Kind regards,<br><strong>The BISHELL Team</strong></p>
         </div>
       </div>
     </div>
    `;

  };
  
  module.exports = generatePasswordResetEmail;