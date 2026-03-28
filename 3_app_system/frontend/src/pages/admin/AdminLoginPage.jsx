import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth.jsx';
import AdminForgotPasswordModal from '../../components/AdminForgotPasswordModal';

const AdminLoginPage = () => {
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
    otp: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [shakeForm, setShakeForm] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated, loading: authLoading } = useAdminAuth();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'otp') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
      setCredentials({ ...credentials, otp: digitsOnly });
      setOtpError(digitsOnly.length > 0 && digitsOnly.length !== 6 ? 'Enter a 6-digit code from Google Authenticator' : '');
    } else {
      setCredentials({ ...credentials, [name]: value });
      if (name === 'email') setEmailError('');
      if (name === 'password') setPasswordError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setEmailError('');
    setPasswordError('');
    setOtpError('');

    const email = credentials.email.trim();
    const password = credentials.password;
    const otp = credentials.otp.trim();

    let valid = true;
    if (!email) {
      setEmailError('Email address is required.');
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address.');
      valid = false;
    }
    if (!password) {
      setPasswordError('Password is required.');
      valid = false;
    }
    if (mfaRequired) {
      if (otp.length !== 6) {
        setOtpError(otp.length === 0 ? 'Enter the 6-digit code from Google Authenticator.' : 'Enter a 6-digit code from Google Authenticator');
        valid = false;
      }
    }
    if (!valid) return;

    setLoading(true);
    try {
      // Use admin login hook
      const result = await login(credentials);
      
      if (result.success) {
        // Navigate to admin dashboard
        navigate('/admin/dashboard');
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please check your credentials.';
      setError(msg);
      if (msg === 'Invalid OTP' || msg === 'OTP required') {
        setMfaRequired(true);
        setOtpError(msg === 'OTP required' ? 'Enter the 6-digit code from Google Authenticator.' : 'Invalid code. Check Google Authenticator and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-green-100 flex flex-col justify-center py-10 sm:py-12 px-4 sm:px-6 lg:px-8 min-w-0 max-w-full overflow-x-hidden">
      <div
        className="mx-auto w-full min-w-0"
        style={{ maxWidth: '480px' }}
      >
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-green-400 rounded-full flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 break-words">
            Admin Access
          </h2>
          <p className="mt-2 text-sm text-gray-600 break-words">
            Sign in to access the administration panel
          </p>
        </div>
      </div>

      <div
        className="mt-8 mx-auto w-full min-w-0"
        style={{ maxWidth: '480px' }}
      >
        <div className="bg-white py-8 px-4 shadow-lg border border-green-200 rounded-xl sm:px-10 min-w-0 w-full">
          <div className="max-w-sm mx-auto w-full min-w-0">
          <form className="space-y-6" onSubmit={handleSubmit} noValidate>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm break-words">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="text"
                  autoComplete="email"
                  value={credentials.email}
                  onChange={handleChange}
                  className={`appearance-none block w-full px-3 py-2 rounded-md shadow-sm placeholder-gray-400 focus:outline-none border ${
                    emailError 
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-300 focus:ring-green-500 focus:border-green-500'
                  }`}
                  placeholder="admin@example.com"
                />
              </div>
              {emailError && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {emailError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={credentials.password}
                  onChange={handleChange}
                  className={`appearance-none block w-full px-3 py-2 pr-10 rounded-md shadow-sm placeholder-gray-400 focus:outline-none border ${
                    passwordError 
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-300 focus:ring-green-500 focus:border-green-500'
                  }`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {passwordError && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {passwordError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                MFA Code
              </label>
              <div className="mt-1">
                <input
                  id="otp"
                  name="otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={credentials.otp}
                  onChange={handleChange}
                  className={`appearance-none block w-full px-3 py-2 rounded-md shadow-sm border ${
                    otpError
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500 placeholder-gray-400 focus:outline-none'
                      : 'border-gray-300 placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500'
                  }`}
                  placeholder="000000"
                  maxLength="6"
                />
              </div>
              {otpError && (
                <p className="mt-1 text-sm text-red-600" role="alert">
                  {otpError}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Enter the 6-digit code from Google Authenticator.
              </p>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-green-300 rounded-md shadow-sm text-sm font-medium text-green-700 bg-green-200 hover:bg-green-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign in to Admin Panel'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Need help?
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-green-600 hover:text-green-500 font-medium"
              >
                Forgot password?
              </button>
              <a
                href="/"
                className="text-sm text-green-600 hover:text-green-500"
              >
                ← Back to main site
              </a>
            </div>
          </div>
          </div>

          <AdminForgotPasswordModal
            isOpen={showForgotPassword}
            onClose={() => setShowForgotPassword(false)}
          />
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-xs text-gray-500">
          This page is restricted to authorized administrators only.
        </p>
      </div>
    </div>
  );
};

export default AdminLoginPage;
