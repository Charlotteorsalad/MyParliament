import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../hooks";
import ForgotPasswordModal from "../../components/ForgotPasswordModal";

function LoginPage() {
  const navigate = useNavigate();
  const { login, loading, error, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [successMsg, setSuccessMsg] = useState("");
  const [showSignUpSlide, setShowSignUpSlide] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [fieldTouched, setFieldTouched] = useState({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const validateEmail = (email) => {
    if (!email) return "Email is required";
    if (!email.includes('@')) return "Please include an '@' in the email address";
    if (!email.includes('.')) return "Please include a domain (e.g., .com)";
    if (email.length < 5) return "Email is too short";
    return null;
  };

  const validatePassword = (password) => {
    if (!password) return "Password is required";
    if (password.length < 8) return "Password must be at least 8 characters";
    return null;
  };

  const validateForm = () => {
    const errors = {};
    
    const emailError = validateEmail(email);
    if (emailError) errors.email = emailError;
    
    const passwordError = validatePassword(password);
    if (passwordError) errors.password = passwordError;
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFieldBlur = (fieldName) => {
    setFieldTouched(prev => ({ ...prev, [fieldName]: true }));
    
    // Validate specific field on blur
    if (fieldName === 'email') {
      const emailError = validateEmail(email);
      setValidationErrors(prev => ({ ...prev, email: emailError }));
    } else if (fieldName === 'password') {
      const passwordError = validatePassword(password);
      setValidationErrors(prev => ({ ...prev, password: passwordError }));
    }
  };

  const handleFieldFocus = (fieldName) => {
    // Mark field as touched when user focuses on it
    setFieldTouched(prev => ({ ...prev, [fieldName]: true }));
  };

  const handleFieldChange = (fieldName, value) => {
    if (fieldName === 'email') {
      setEmail(value);
    } else if (fieldName === 'password') {
      setPassword(value);
    }
    
    // Clear validation error when user starts typing
    if (validationErrors[fieldName]) {
      setValidationErrors(prev => ({ ...prev, [fieldName]: "" }));
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    clearError();
    
    console.log('Attempting user login...');
    console.log('Current auth state before login:', {
      adminToken: !!localStorage.getItem('adminToken'),
      userToken: !!localStorage.getItem('token'),
      sessionToken: !!sessionStorage.getItem('token')
    });
    
    // Mark all fields as touched so validation errors will show
    setFieldTouched({ email: true, password: true });
    
    if (!validateForm()) {
      return;
    }

    try {
      const result = await login({ email, password, remember });
      setSuccessMsg("Login successful!");
      console.log('Login result:', result);
      console.log('Auth state after login:', {
        adminToken: !!localStorage.getItem('adminToken'),
        userToken: !!localStorage.getItem('token'),
        sessionToken: !!sessionStorage.getItem('token')
      });
      // Wait a bit longer to ensure state is updated
      setTimeout(() => {
        console.log('Navigating to profile...');
        navigate("/profile");
      }, 1000);
    } catch (err) {
      console.error("Login failed:", err);
      // Handle specific authentication errors
      if (err.message?.includes('email') || err.message?.includes('user')) {
        setValidationErrors(prev => ({ ...prev, email: "Email not found or invalid" }));
      } else if (err.message?.includes('password') || err.message?.includes('credentials')) {
        setValidationErrors(prev => ({ ...prev, password: "Incorrect password" }));
      }
    }
  };

  const handleSlideToSignUp = () => {
    setShowSignUpSlide(true);
    setTimeout(() => navigate("/register"), 600);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header - simple brand only */}
      <div className="w-full bg-white shadow-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#C3C3E5] to-[#A8A8D8] flex items-center justify-center mr-3">
              <svg className="w-6 h-6 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-800">My Parliament</span>
          </div>
          <Link to="/" className="text-sm font-medium text-gray-700 hover:text-gray-900">Back to Home</Link>
        </div>
      </div>

      {/* Decorative blurred background layer */}
      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#C3C3E5] via-[#e9e9f8] to-white" />
          <div className="absolute inset-0 bg-[url('/images/placeholders/hero.jpg')] bg-cover bg-center opacity-30" />
          <div className="absolute inset-0 backdrop-blur-sm" />
        </div>

        {/* Split layout with consistent dimensions */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="relative w-full overflow-hidden rounded-2xl shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[620px]">
              {/* Left: Login Card */}
              <div className="relative bg-white/90 backdrop-blur p-8 flex items-center">
                <div className="w-full max-w-md mx-auto">
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
                  <p className="text-gray-600 mb-6">Sign in to continue</p>

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">{error}</div>
                  )}
                  {successMsg && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md">{successMsg}</div>
                  )}

                  <form onSubmit={handleLogin} className="space-y-4" noValidate>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        placeholder="you@example.com"
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#C3C3E5] focus:border-transparent ${
                          validationErrors.email ? 'border-red-500' : 'border-gray-300'
                        }`}
                        value={email}
                        onChange={(e) => handleFieldChange('email', e.target.value)}
                        onFocus={() => handleFieldFocus('email')}
                        onBlur={() => handleFieldBlur('email')}
                        disabled={loading}
                        required
                      />
                      {validationErrors.email && fieldTouched.email && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className={`w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-[#C3C3E5] focus:border-transparent ${
                            validationErrors.password ? 'border-red-500' : 'border-gray-300'
                          }`}
                          value={password}
                          onChange={(e) => handleFieldChange('password', e.target.value)}
                          onFocus={() => handleFieldFocus('password')}
                          onBlur={() => handleFieldBlur('password')}
                          disabled={loading}
                          required
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)} 
                          className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/>
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                            </svg>
                          )}
                        </button>
                      </div>
                      {validationErrors.password && fieldTouched.password && (
                        <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>
                      )}
                      <div className="mt-3 flex items-center justify-between">
                        <label className="inline-flex items-center text-sm text-gray-700">
                          <input
                            type="checkbox"
                            className="h-4 w-4 text-[#C3C3E5] border-gray-300 rounded focus:ring-[#C3C3E5]"
                            checked={remember}
                            onChange={(e) => setRemember(e.target.checked)}
                          />
                          <span className="ml-2">Remember me</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowForgotPassword(true)}
                          className="text-sm text-[#C3C3E5] hover:text-[#A8A8D8] transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-[#C3C3E5] to-[#A8A8D8] text-white py-3 rounded-lg font-medium hover:from-[#B8B8E0] hover:to-[#9D9DD3] focus:ring-2 focus:ring-[#C3C3E5] focus:ring-offset-2"
                      disabled={loading}
                    >
                      {loading ? "Logging in..." : "Sign In"}
                    </button>
                  </form>
                </div>
              </div>

              {/* Right: CTA panel to register */}
              <div className="relative hidden lg:block">
                <div className="absolute inset-0 bg-black/30"></div>
                <div className="relative h-full flex items-center justify-center p-8">
                  <div className="text-center text-white max-w-sm">
                    <h3 className="text-2xl font-semibold mb-2">New here?</h3>
                    <p className="text-white/85 mb-6">Create your account and join My Parliament.</p>
                    <button
                      onClick={handleSlideToSignUp}
                      className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-white/95 text-gray-900 hover:bg-white transition"
                    >
                      Create an account
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8l-4 4m0 0l4 4m-4-4h18" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Full-screen slide overlay (covers entire container) */}
            <div className={`absolute inset-0 bg-white/95 backdrop-blur transform transition-transform duration-600 ease-out ${showSignUpSlide ? "translate-x-0" : "translate-x-full"}`} aria-hidden={!showSignUpSlide}>
              <div className="h-full flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-[#C3C3E5] to-[#A8A8D8] mb-6 flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c.943 0 1.714-.771 1.714-1.714S12.943 7.571 12 7.571 10.286 8.343 10.286 9.286 11.057 11 12 11z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.429 19.429a7.429 7.429 0 10-14.858 0" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">Taking you to Sign Up</h3>
                  <p className="text-gray-600">Creating your account...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal 
        isOpen={showForgotPassword} 
        onClose={() => setShowForgotPassword(false)} 
      />
    </div>
  );
}

export default LoginPage;
