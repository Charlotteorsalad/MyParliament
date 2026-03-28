import { useState } from 'react';
import { authApi } from '../api/authApi';

function ForgotPasswordModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const result = await authApi.forgotPassword(email);
      if (result.resetUrl) {
        // Development mode or email service not configured - show the reset URL
        setMessage(`Password reset link generated: ${result.resetUrl}`);
      } else {
        setMessage('Password reset email sent! Please check your inbox and spam folder.');
      }
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-[320px]">
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
            Enter your email and we'll send you a reset link.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C3C3E5] focus:border-transparent"
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-100 text-red-700 rounded-lg text-xs">
                {error}
              </div>
            )}

            {message && (
              <div className="p-2.5 bg-green-50 border border-green-100 text-green-700 rounded-lg text-xs break-all">
                {message}
              </div>
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
              <button
                type="submit"
                className="flex-1 px-3 py-2 text-sm bg-gradient-to-r from-[#C3C3E5] to-[#A8A8D8] text-white rounded-lg font-medium hover:from-[#B8B8E0] hover:to-[#9D9DD3] focus:ring-2 focus:ring-[#C3C3E5] focus:ring-offset-2 disabled:opacity-50"
                disabled={loading || !email}
              >
                {loading ? 'Sending...' : 'Send Link'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordModal;
