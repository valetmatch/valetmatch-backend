const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendPasswordSetupEmail(email, businessName, setupUrl) {
  const msg = {
    to: email,
    from: process.env.FROM_EMAIL || 'valetmatch@gmail.com',
    subject: '🎉 Welcome to Valet Match - Set Your Password',
    text: `Hi ${businessName},\n\nGreat news! Your application to join Valet Match has been approved.\n\nClick the link below to set your password and access your valeter portal:\n\n${setupUrl}\n\nThis link will expire in 24 hours for security.\n\nWelcome to the team!\n\nValet Match Team`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .features { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .feature-item { padding: 10px 0; border-bottom: 1px solid #e2e8f0; }
          .feature-item:last-child { border-bottom: none; }
          .footer { text-align: center; color: #64748b; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Valet Match!</h1>
            <p style="margin: 0;">Your application has been approved</p>
          </div>
          <div class="content">
            <p>Hi <strong>${businessName}</strong>,</p>
            
            <p>Great news! Your application to join Valet Match has been <strong>approved</strong>.</p>
            
            <p>Click the button below to set your password and access your valeter portal:</p>
            
            <center>
              <a href="${setupUrl}" class="button">Set Your Password</a>
            </center>
            
            <p style="font-size: 13px; color: #64748b;">Or copy this link: <br><span style="word-break: break-all;">${setupUrl}</span></p>
            
            <p style="color: #dc2626; font-size: 13px;">⚠️ This link will expire in 24 hours for security.</p>
            
            <div class="features">
              <h3 style="margin-top: 0;">Once you're logged in, you can:</h3>
              <div class="feature-item">✓ View incoming bookings in real-time</div>
              <div class="feature-item">✓ Manage your availability and schedule</div>
              <div class="feature-item">✓ Update your profile and service areas</div>
              <div class="feature-item">✓ Track your earnings and commission</div>
            </div>
            
            <p>If you have any questions, reply to this email and we'll be happy to help.</p>
            
            <p><strong>Welcome to the team!</strong></p>
            
            <p>Valet Match Team<br>
            <a href="mailto:valetmatch@gmail.com">valetmatch@gmail.com</a></p>
          </div>
          <div class="footer">
            <p>© 2024 Valet Match. All rights reserved.</p>
            <p>This email was sent to ${email}</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Password setup email sent to ${email}`);
    return { success: true };
  } catch (error) {
    console.error('❌ SendGrid error:', error);
    if (error.response) {
      console.error('SendGrid response:', error.response.body);
    }
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendPasswordSetupEmail
};
