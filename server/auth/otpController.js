const crypto = require('crypto');
const OtpVerification = require('./otpModel');
const { sendOtpEmail } = require('../utils/sendEmail');

const MAX_ATTEMPTS = 3;
const OTP_EXPIRY_MINUTES = 5;

/**
 * Generate a cryptographically secure 6-digit OTP
 */
function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * POST /api/auth/send-otp
 * Generates a new OTP, stores it (hashed), and sends it via email.
 */
exports.sendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Invalidate any previous unused OTPs for this email
    await OtpVerification.deleteMany({ email: email.toLowerCase(), verified: false });

    // Generate OTP
    const plainOtp = generateOtp();

    // Create OTP record (OTP is hashed in the pre-save hook)
    const otpDoc = new OtpVerification({
      email: email.toLowerCase(),
      otp: plainOtp,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    });

    await otpDoc.save();

    // Send OTP email
    await sendOtpEmail(email, plainOtp);

    return res.status(200).json({
      message: 'OTP sent successfully',
      expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
    });
  } catch (error) {
    console.error('Send OTP Error:', error);
    return res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
  }
};

/**
 * POST /api/auth/verify-otp
 * Verifies the OTP against the stored hash.
 */
exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    // Find the latest un-verified OTP for this email
    const otpDoc = await OtpVerification.findOne({
      email: email.toLowerCase(),
      verified: false,
    }).sort({ createdAt: -1 });

    if (!otpDoc) {
      return res.status(400).json({ error: 'No OTP found. Please request a new one.' });
    }

    // Check if expired
    if (otpDoc.expiresAt < new Date()) {
      await OtpVerification.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }

    // Check attempts limit
    if (otpDoc.attempts >= MAX_ATTEMPTS) {
      await OtpVerification.deleteOne({ _id: otpDoc._id });
      return res.status(429).json({ error: 'Too many failed attempts. Please request a new OTP.' });
    }

    // Compare OTP (bcrypt comparison)
    const isMatch = await otpDoc.compareOtp(otp);

    if (!isMatch) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      const remaining = MAX_ATTEMPTS - otpDoc.attempts;
      return res.status(400).json({
        error: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      });
    }

    // OTP is correct — mark as verified and generate a verification token
    const verificationToken = crypto.randomUUID();
    otpDoc.verified = true;
    otpDoc.verificationToken = verificationToken;
    await otpDoc.save();

    return res.status(200).json({
      message: 'OTP verified successfully',
      verification_token: verificationToken,
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    return res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
};

/**
 * POST /api/auth/resend-otp
 * Invalidates previous OTPs and sends a new one.
 */
exports.resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Delete old OTPs
    await OtpVerification.deleteMany({ email: email.toLowerCase(), verified: false });

    // Generate new OTP
    const plainOtp = generateOtp();

    const otpDoc = new OtpVerification({
      email: email.toLowerCase(),
      otp: plainOtp,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    });

    await otpDoc.save();

    // Send OTP email
    await sendOtpEmail(email, plainOtp);

    return res.status(200).json({
      message: 'New OTP sent successfully',
      expiresIn: OTP_EXPIRY_MINUTES * 60,
    });
  } catch (error) {
    console.error('Resend OTP Error:', error);
    return res.status(500).json({ error: 'Failed to resend OTP. Please try again.' });
  }
};

/**
 * POST /api/auth/reset-password
 * Resets the user's password after OTP verification.
 * Requires: email, new_password, verification_token
 */
exports.resetPassword = async (req, res) => {
  try {
    const { email, new_password, verification_token } = req.body;

    if (!email || !new_password || !verification_token) {
      return res.status(400).json({ error: 'Email, new_password, and verification_token are required' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Validate the verification token from MongoDB
    const otpDoc = await OtpVerification.findOne({
      email: email.toLowerCase(),
      verificationToken: verification_token,
      verified: true,
    });

    if (!otpDoc) {
      return res.status(403).json({ error: 'Invalid or expired verification. Please start over.' });
    }

    // Check token is within 10 minutes of creation
    const ageMs = Date.now() - new Date(otpDoc.createdAt).getTime();
    if (ageMs > 10 * 60 * 1000) {
      await OtpVerification.deleteOne({ _id: otpDoc._id });
      return res.status(403).json({ error: 'Verification expired. Please request a new OTP.' });
    }

    // Call the Supabase Edge Function to update the password
    // The edge function has the service_role_key built-in
    const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bjqjzaggovihrbjuuvsa.supabase.co';
    const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY;

    const updateRes = await fetch(`${SUPABASE_URL}/functions/v1/reset-password`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON}`
      },
      body: JSON.stringify({ email: email.toLowerCase(), new_password }),
    });

    const updateData = await updateRes.json();

    if (!updateRes.ok) {
      throw new Error(updateData.error || 'Failed to update password');
    }

    // Cleanup the used OTP
    await OtpVerification.deleteOne({ _id: otpDoc._id });

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to reset password' });
  }
};
