import { useState, useEffect } from 'react';
import { authApi } from '../api/authApi';

const RESEND_COOLDOWN_SECONDS = 30;

function AdminForgotPasswordModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const sendResetEmail = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    setError('');
    try {
      await authApi.adminForgotPassword(trimmed);
      setMessage('If an admin account exists for this email, a reset link has been sent (valid for 10 minutes). Please check your inbox and spam folder.');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    await sendResetEmail();
  };

  const handleResend = async (e) => {
    e.preventDefault();
    if (resendCooldown > 0 || loading) return;
    await sendResetEmail();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl border border-green-200 w-full max-w-[320px]">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className="text-base font-semibold text-gray-900 shrink-0">Forgot Password</h3>
            <button
              onClick={onClose}
              className="shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-gray-600 text-sm mb-4 leading-snug">
            Enter your admin email and we'll send you a reset link. The link is valid for 10 minutes only.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <div>
              <label htmlFor="admin-forgot-email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="text"
                id="admin-forgot-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="admin@example.com"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-100 text-red-700 rounded-lg text-xs">
                {error}
              </div>
            )}

            {message && (
              <>
                <div className="p-2.5 bg-green-50 border border-green-100 text-green-700 rounded-lg text-xs break-all">
                  {message}
                </div>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading || resendCooldown > 0}
                  className="w-full px-3 py-2 text-sm bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
                </button>
              </>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              {!message && (
                <button
                  type="submit"
                  className="flex-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                  disabled={loading || !email.trim()}
                >
                  {loading ? 'Sending...' : 'Send Link'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AdminForgotPasswordModal;
