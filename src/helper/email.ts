
import nodemailer from "nodemailer";
import { smtp_pass, smtp_user } from "../secret";

interface EmailData {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    cc?: string | string[];
    bcc?: string | string[];
    attachments?: Array<{
        filename: string;
        content: Buffer | string;
        contentType?: string;
    }>;
    replyTo?: string;
}

interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

// Validate email configuration on startup
const validateConfig = () => {
    if (!smtp_user || !smtp_pass) {
        throw new Error("SMTP credentials are missing. Check your secret configuration.");
    }
};

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
        user: smtp_user,
        pass: smtp_pass
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 20000,
    rateLimit: 5,
});

// Verify transporter configuration
transporter.verify((error, success) => {
    if (error) {
        console.error("SMTP configuration error:", error);
    } else {
        console.log("SMTP server is ready to take messages");
    }
});

export const sendEmail = async (emailData: EmailData): Promise<EmailResult> => {
    try {
        validateConfig();

        if (!emailData.to) {
            throw new Error("Recipient email address is required");
        }
        if (!emailData.subject) {
            throw new Error("Email subject is required");
        }
        if (!emailData.text && !emailData.html) {
            throw new Error("Either text or HTML content is required");
        }

        const info = await transporter.sendMail({
            from: `"Store Messenger" <${smtp_user}>`,
            ...emailData,
        });

        console.log(`✅ Email sent successfully to ${emailData.to}: ${info.messageId}`);

        return {
            success: true,
            messageId: info.messageId
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`❌ SMTP Error sending to ${emailData.to}:`, errorMessage);

        // Check for common Gmail errors to provide better feedback
        if (errorMessage.includes("535-5.7.8")) {
            console.error("💡 TIP: This is an authentication error. Ensure your SMTP_PASS is a valid Google App Password and that 2FA is enabled on your account.");
        }

        return {
            success: false,
            error: errorMessage
        };
    }
};

// Chat-style email functions
export const sendWelcomeEmail = async (userEmail: string, userName: string): Promise<EmailResult> => {
    return sendEmail({
        to: userEmail,
        subject: `👋 Welcome to Our Store, ${userName}!`,
        html: `
            <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; background: #f0f2f5; padding: 20px;">
                <div style="background: #0084ff; color: white; padding: 15px 20px; border-radius: 20px 20px 5px 5px; text-align: center;">
                    <strong>Store Messenger</strong>
                </div>
                
                <div style="margin-top: 15px;">
                    <div style="display: flex; align-items: start; margin-bottom: 15px;">
                        <div style="background: #e4e6eb; padding: 12px 16px; border-radius: 18px; max-width: 80%;">
                            <div style="font-size: 14px; color: #050505; line-height: 1.4;">
                                Hey ${userName}! 👋 Welcome to our store! I'm your shopping assistant.
                            </div>
                            <div style="font-size: 11px; color: #65676b; text-align: right; margin-top: 5px;">
                                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; align-items: start; margin-bottom: 15px;">
                        <div style="background: #0084ff; color: white; padding: 12px 16px; border-radius: 18px; max-width: 80%; margin-left: auto;">
                            <div style="font-size: 14px; line-height: 1.4;">
                                <strong>Quick things you can do:</strong>
                            </div>
                            <div style="margin-top: 8px;">
                                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/products" 
                                   style="display: block; background: rgba(255,255,255,0.2); padding: 8px 12px; border-radius: 10px; margin: 5px 0; color: white; text-decoration: none; font-size: 13px;">
                                   🛍️ Browse Products
                                </a>
                                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/profile" 
                                   style="display: block; background: rgba(255,255,255,0.2); padding: 8px 12px; border-radius: 10px; margin: 5px 0; color: white; text-decoration: none; font-size: 13px;">
                                   👤 Complete Profile
                                </a>
                            </div>
                            <div style="font-size: 11px; text-align: right; margin-top: 5px; opacity: 0.8;">
                                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 20px; padding: 15px; color: #65676b; font-size: 12px;">
                    This is an automated message. Need help? 
                    <a href="mailto:support@store.com" style="color: #0084ff; text-decoration: none;">Reply to this email</a>
                </div>
            </div>
        `
    });
};

export const sendOrderConfirmation = async (
    userEmail: string,
    userName: string,
    orderNumber: string,
    orderTotal: number,
    itemsCount: number
): Promise<EmailResult> => {
    return sendEmail({
        to: userEmail,
        subject: `✅ Order #${orderNumber} Confirmed`,
        html: `
            <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; background: #f0f2f5; padding: 20px;">
                <div style="background: #00a400; color: white; padding: 15px 20px; border-radius: 20px 20px 5px 5px; text-align: center;">
                    <strong>Order Updates</strong>
                </div>
                
                <div style="margin-top: 15px;">
                    <div style="display: flex; align-items: start; margin-bottom: 15px;">
                        <div style="background: #e4e6eb; padding: 12px 16px; border-radius: 18px; max-width: 80%;">
                            <div style="font-size: 14px; color: #050505; line-height: 1.4;">
                                🎉 Your order <strong>#${orderNumber}</strong> has been confirmed!
                            </div>
                            <div style="font-size: 11px; color: #65676b; text-align: right; margin-top: 5px;">
                                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; align-items: start; margin-bottom: 15px;">
                        <div style="background: #0084ff; color: white; padding: 12px 16px; border-radius: 18px; max-width: 80%; margin-left: auto;">
                            <div style="font-size: 14px; line-height: 1.4;">
                                <strong>Order Summary:</strong>
                            </div>
                            <div style="margin-top: 8px; font-size: 13px;">
                                <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                                    <span>Items:</span>
                                    <span>${itemsCount}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                                    <span>Total:</span>
                                    <span><strong>$${orderTotal.toFixed(2)}</strong></span>
                                </div>
                            </div>
                            <div style="font-size: 11px; text-align: right; margin-top: 5px; opacity: 0.8;">
                                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; align-items: start; margin-bottom: 15px;">
                        <div style="background: #e4e6eb; padding: 12px 16px; border-radius: 18px; max-width: 80%;">
                            <div style="font-size: 14px; color: #050505; line-height: 1.4;">
                                <strong>What's next?</strong><br>
                                We'll send you another message when your order ships.
                            </div>
                            <div style="margin-top: 10px;">
                                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/orders/${orderNumber}" 
                                   style="display: inline-block; background: #0084ff; color: white; padding: 8px 16px; border-radius: 15px; text-decoration: none; font-size: 13px;">
                                   📦 Track Order
                                </a>
                            </div>
                            <div style="font-size: 11px; color: #65676b; text-align: right; margin-top: 5px;">
                                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 20px; padding: 15px; color: #65676b; font-size: 12px;">
                    This is an automated message. Questions? <a href="mailto:orders@store.com" style="color: #0084ff; text-decoration: none;">Contact orders team</a>
                </div>
            </div>
        `
    });
};

export const sendVerificationEmail = async (
    userEmail: string,
    userName: string,
    verificationToken: string
): Promise<EmailResult> => {
    return sendEmail({
        to: userEmail,
        subject: `🔐 Verify Your Email`,
        html: `
            <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; background: #f0f2f5; padding: 20px;">
                <div style="background: #ff6b6b; color: white; padding: 15px 20px; border-radius: 20px 20px 5px 5px; text-align: center;">
                    <strong>Security Verification</strong>
                </div>
                
                <div style="margin-top: 15px;">
                    <div style="display: flex; align-items: start; margin-bottom: 15px;">
                        <div style="background: #e4e6eb; padding: 12px 16px; border-radius: 18px; max-width: 80%;">
                            <div style="font-size: 14px; color: #050505; line-height: 1.4;">
                                Hi ${userName}! Please verify your email to secure your account.
                            </div>
                            <div style="font-size: 11px; color: #65676b; text-align: right; margin-top: 5px;">
                                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; align-items: start; margin-bottom: 15px;">
                        <div style="background: #0084ff; color: white; padding: 15px; border-radius: 18px; max-width: 80%; margin-left: auto; text-align: center;">
                            <div style="font-size: 13px; margin-bottom: 10px;">Your verification code:</div>
                            <div style="font-size: 24px; font-weight: bold; letter-spacing: 3px; background: rgba(255,255,255,0.2); padding: 10px; border-radius: 10px;">
                                ${verificationToken}
                            </div>
                            <div style="font-size: 11px; margin-top: 10px; opacity: 0.8;">
                                Expires in 24 hours
                            </div>
                            <div style="font-size: 11px; text-align: right; margin-top: 5px; opacity: 0.8;">
                                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; align-items: start; margin-bottom: 15px;">
                        <div style="background: #e4e6eb; padding: 12px 16px; border-radius: 18px; max-width: 80%;">
                            <div style="font-size: 14px; color: #050505; line-height: 1.4;">
                                Or click below to verify instantly:
                            </div>
                            <div style="margin-top: 10px;">
                                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}" 
                                   style="display: inline-block; background: #00a400; color: white; padding: 10px 20px; border-radius: 15px; text-decoration: none; font-size: 14px; font-weight: bold;">
                                   ✅ Verify Email
                                </a>
                            </div>
                            <div style="font-size: 11px; color: #65676b; text-align: right; margin-top: 5px;">
                                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 20px; padding: 15px; color: #65676b; font-size: 12px;">
                    This is an automated message. Didn't request this? <a href="mailto:support@store.com" style="color: #0084ff; text-decoration: none;">Contact support</a>
                </div>
            </div>
        `
    });
};

// Additional chat-style email functions
export const sendPasswordResetEmail = async (
    userEmail: string,
    userName: string,
    resetToken: string
): Promise<EmailResult> => {
    return sendEmail({
        to: userEmail,
        subject: `🔑 Reset Your Password`,
        html: `
            <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; background: #f0f2f5; padding: 20px;">
                <div style="background: #ff6b6b; color: white; padding: 15px 20px; border-radius: 20px 20px 5px 5px; text-align: center;">
                    <strong>Password Reset</strong>
                </div>
                
                <div style="margin-top: 15px;">
                    <div style="display: flex; align-items: start; margin-bottom: 15px;">
                        <div style="background: #e4e6eb; padding: 12px 16px; border-radius: 18px; max-width: 80%;">
                            <div style="font-size: 14px; color: #050505; line-height: 1.4;">
                                Hi ${userName}! We received a request to reset your password.
                            </div>
                            <div style="font-size: 11px; color: #65676b; text-align: right; margin-top: 5px;">
                                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; align-items: start; margin-bottom: 15px;">
                        <div style="background: #0084ff; color: white; padding: 12px 16px; border-radius: 18px; max-width: 80%; margin-left: auto;">
                            <div style="font-size: 14px; line-height: 1.4;">
                                Click below to reset your password:
                            </div>
                            <div style="margin-top: 10px; text-align: center;">
                                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}" 
                                   style="display: inline-block; background: rgba(255,255,255,0.2); color: white; padding: 10px 20px; border-radius: 15px; text-decoration: none; font-size: 14px; font-weight: bold;">
                                   🔑 Reset Password
                                </a>
                            </div>
                            <div style="font-size: 11px; text-align: right; margin-top: 5px; opacity: 0.8;">
                                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>

                    <div style="display: flex; align-items: start; margin-bottom: 15px;">
                        <div style="background: #e4e6eb; padding: 12px 16px; border-radius: 18px; max-width: 80%;">
                            <div style="font-size: 14px; color: #050505; line-height: 1.4;">
                                <strong>Note:</strong> This link expires in 1 hour. If you didn't request this, please ignore this message.
                            </div>
                            <div style="font-size: 11px; color: #65676b; text-align: right; margin-top: 5px;">
                                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 20px; padding: 15px; color: #65676b; font-size: 12px;">
                    This is an automated message. Need help? <a href="mailto:support@store.com" style="color: #0084ff; text-decoration: none;">Contact support</a>
                </div>
            </div>
        `
    });
};

 
// Admin to user email function
export const sendAdminToUserEmail = async (
  adminName: string,
  adminEmail: string,
  userEmail: string,
  userName: string,
  subject: string,
  message: string
): Promise<EmailResult> => {
  return sendEmail({
    to: userEmail,
    cc: adminEmail, 
    subject: `📨 ${subject}`,
    html: `
      <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; background: #f0f2f5; padding: 20px;">
        <div style="background: #6c5ce7; color: white; padding: 15px 20px; border-radius: 20px 20px 5px 5px; text-align: center;">
          <strong>Administrator Message</strong>
        </div>
        
        <div style="margin-top: 15px;">
          <div style="display: flex; align-items: start; margin-bottom: 15px;">
            <div style="background: #e4e6eb; padding: 12px 16px; border-radius: 18px; max-width: 80%;">
              <div style="font-size: 14px; color: #050505; line-height: 1.4;">
                Hi ${userName}! You have received a message from the administrator.
              </div>
              <div style="font-size: 11px; color: #65676b; text-align: right; margin-top: 5px;">
                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: start; margin-bottom: 15px;">
            <div style="background: #6c5ce7; color: white; padding: 12px 16px; border-radius: 18px; max-width: 80%; margin-left: auto;">
              <div style="font-size: 14px; line-height: 1.4; margin-bottom: 5px;">
                <strong>From:</strong> ${adminName}
              </div>
              <div style="font-size: 14px; line-height: 1.4; margin-bottom: 5px;">
                <strong>Subject:</strong> ${subject}
              </div>
              <div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 10px; margin: 10px 0; font-size: 13px; line-height: 1.5;">
                ${message.replace(/\n/g, '<br>')}
              </div>
              <div style="font-size: 11px; text-align: right; margin-top: 5px; opacity: 0.8;">
                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: start; margin-bottom: 15px;">
            <div style="background: #e4e6eb; padding: 12px 16px; border-radius: 18px; max-width: 80%;">
              <div style="font-size: 14px; color: #050505; line-height: 1.4;">
                <strong>How to reply?</strong><br>
                You can reply directly to this email or contact support if needed.
              </div>
              <div style="margin-top: 10px;">
                <a href="mailto:${adminEmail}" 
                   style="display: inline-block; background: #00b894; color: white; padding: 8px 16px; border-radius: 15px; text-decoration: none; font-size: 13px;">
                   📧 Reply to Admin
                </a>
              </div>
              <div style="font-size: 11px; color: #65676b; text-align: right; margin-top: 5px;">
                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px; padding: 15px; color: #65676b; font-size: 12px;">
          This is an official message from the administration team.
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/support" 
             style="color: #6c5ce7; text-decoration: none; margin-left: 5px;">Contact Support</a>
        </div>
      </div>
    `
  });
};

// User account status update email
export const sendAccountStatusEmail = async (
  userEmail: string,
  userName: string,
  statusType: 'banned' | 'suspended' | 'activated' | 'deleted',
  reason?: string,
  duration?: string
): Promise<EmailResult> => {
  const statusMessages = {
    banned: {
      subject: '🚫 Account Banned',
      color: '#ff4757',
      title: 'Account Banned',
      message: 'Your account has been permanently banned from our platform.',
    },
    suspended: {
      subject: '⏸️ Account Suspended',
      color: '#ffa502',
      title: 'Account Suspended',
      message: `Your account has been temporarily suspended.${duration ? ` Duration: ${duration}` : ''}`,
    },
    activated: {
      subject: '✅ Account Reactivated',
      color: '#2ed573',
      title: 'Account Reactivated',
      message: 'Your account has been reactivated and you can now access all features.',
    },
    deleted: {
      subject: '🗑️ Account Deleted',
      color: '#576574',
      title: 'Account Deleted',
      message: 'Your account has been deleted as per your request.',
    }
  };

  const status = statusMessages[statusType];

  return sendEmail({
    to: userEmail,
    subject: status.subject,
    html: `
      <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; background: #f0f2f5; padding: 20px;">
        <div style="background: ${status.color}; color: white; padding: 15px 20px; border-radius: 20px 20px 5px 5px; text-align: center;">
          <strong>Account Status Update</strong>
        </div>
        
        <div style="margin-top: 15px;">
          <div style="display: flex; align-items: start; margin-bottom: 15px;">
            <div style="background: #e4e6eb; padding: 12px 16px; border-radius: 18px; max-width: 80%;">
              <div style="font-size: 14px; color: #050505; line-height: 1.4;">
                Hi ${userName}, we're writing to inform you about an important account update.
              </div>
              <div style="font-size: 11px; color: #65676b; text-align: right; margin-top: 5px;">
                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: start; margin-bottom: 15px;">
            <div style="background: ${status.color}; color: white; padding: 12px 16px; border-radius: 18px; max-width: 80%; margin-left: auto;">
              <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">
                ${status.title}
              </div>
              <div style="font-size: 14px; line-height: 1.4; margin-bottom: 8px;">
                ${status.message}
              </div>
              ${reason ? `
                <div style="background: rgba(255,255,255,0.2); padding: 8px; border-radius: 8px; margin: 8px 0; font-size: 13px;">
                  <strong>Reason:</strong> ${reason}
                </div>
              ` : ''}
              <div style="font-size: 11px; text-align: right; margin-top: 5px; opacity: 0.8;">
                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          ${statusType === 'banned' || statusType === 'suspended' ? `
            <div style="display: flex; align-items: start; margin-bottom: 15px;">
              <div style="background: #e4e6eb; padding: 12px 16px; border-radius: 18px; max-width: 80%;">
                <div style="font-size: 14px; color: #050505; line-height: 1.4;">
                  <strong>Next Steps:</strong><br>
                  If you believe this is a mistake, you can appeal this decision.
                </div>
                <div style="margin-top: 10px;">
                  <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/support" 
                     style="display: inline-block; background: ${status.color}; color: white; padding: 8px 16px; border-radius: 15px; text-decoration: none; font-size: 13px;">
                     📝 Appeal Decision
                  </a>
                </div>
                <div style="font-size: 11px; color: #65676b; text-align: right; margin-top: 5px;">
                  ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ` : ''}
        </div>

        <div style="text-align: center; margin-top: 20px; padding: 15px; color: #65676b; font-size: 12px;">
          This is an automated message from our account management system.
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/help" 
             style="color: ${status.color}; text-decoration: none; margin-left: 5px;">Help Center</a>
        </div>
      </div>
    `
  });
};

// Role change notification email
export const sendRoleChangeEmail = async (
  userEmail: string,
  userName: string,
  oldRole: string,
  newRole: string,
  changedBy: string
): Promise<EmailResult> => {
  const roleColors: Record<string, string> = {
    user: '#74b9ff',
    moderator: '#00b894',
    admin: '#6c5ce7',
    super_admin: '#fd79a8'
  };

  return sendEmail({
    to: userEmail,
    subject: '👑 Your Role Has Been Updated',
    html: `
      <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 500px; margin: 0 auto; background: #f0f2f5; padding: 20px;">
        <div style="background: #fdcb6e; color: white; padding: 15px 20px; border-radius: 20px 20px 5px 5px; text-align: center;">
          <strong>Role Update Notification</strong>
        </div>
        
        <div style="margin-top: 15px;">
          <div style="display: flex; align-items: start; margin-bottom: 15px;">
            <div style="background: #e4e6eb; padding: 12px 16px; border-radius: 18px; max-width: 80%;">
              <div style="font-size: 14px; color: #050505; line-height: 1.4;">
                Hi ${userName}! Your account role has been updated by an administrator.
              </div>
              <div style="font-size: 11px; color: #65676b; text-align: right; margin-top: 5px;">
                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: start; margin-bottom: 15px;">
            <div style="background: #fdcb6e; color: white; padding: 12px 16px; border-radius: 18px; max-width: 80%; margin-left: auto;">
              <div style="display: flex; align-items: center; margin-bottom: 10px; gap: 10px;">
                <div style="background: ${roleColors[oldRole] || '#74b9ff'}; padding: 6px 12px; border-radius: 10px; font-size: 12px;">
                  ${oldRole.toUpperCase()}
                </div>
                <div style="font-size: 18px;">→</div>
                <div style="background: ${roleColors[newRole] || '#00b894'}; padding: 6px 12px; border-radius: 10px; font-size: 12px;">
                  ${newRole.toUpperCase()}
                </div>
              </div>
              <div style="font-size: 13px; margin-bottom: 5px;">
                <strong>Changed by:</strong> ${changedBy}
              </div>
              <div style="font-size: 13px;">
                <strong>Effective immediately</strong>
              </div>
              <div style="font-size: 11px; text-align: right; margin-top: 5px; opacity: 0.8;">
                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: start; margin-bottom: 15px;">
            <div style="background: #e4e6eb; padding: 12px 16px; border-radius: 18px; max-width: 80%;">
              <div style="font-size: 14px; color: #050505; line-height: 1.4;">
                <strong>What this means:</strong><br>
                Your permissions and access levels have been updated accordingly.
              </div>
              <div style="margin-top: 10px;">
                <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/profile" 
                   style="display: inline-block; background: #fdcb6e; color: white; padding: 8px 16px; border-radius: 15px; text-decoration: none; font-size: 13px;">
                   👤 View Your Profile
                </a>
              </div>
              <div style="font-size: 11px; color: #65676b; text-align: right; margin-top: 5px;">
                ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px; padding: 15px; color: #65676b; font-size: 12px;">
          This change was made by an authorized administrator.
          <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/help/permissions" 
             style="color: #fdcb6e; text-decoration: none; margin-left: 5px;">Learn about roles</a>
        </div>
      </div>
    `
  });
};

export type { EmailResult };