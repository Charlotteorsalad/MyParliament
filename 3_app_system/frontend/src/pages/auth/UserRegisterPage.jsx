import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks";
import { authApi } from "../../api";

function UserRegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, loading, error, clearError } = useAuth();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [showLoginSlide, setShowLoginSlide] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [fieldTouched, setFieldTouched] = useState({});

  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: "", color: "text-gray-400" });
  const [requirements, setRequirements] = useState({ length: false, uppercase: false, lowercase: false, number: false, special: false });

  // Function to restore saved form data
  const restoreFormData = () => {
    const savedFormData = localStorage.getItem('registrationStep1Data');
    if (savedFormData) {
      try {
        const parsedData = JSON.parse(savedFormData);
        console.log('Restoring saved form data:', parsedData); // Debug log
        
        // Only restore if the data has actual values
        if (parsedData.username || parsedData.email || parsedData.password || parsedData.confirmPassword) {
          setForm(prev => ({ ...prev, ...parsedData }));
        }
      } catch (error) {
        console.error('Error parsing saved form data:', error);
      }
    } else {
      console.log('No saved form data found'); // Debug log
    }
  };

  // Restore form data when component mounts
  useEffect(() => {
    console.log('Component mounted, restoring data...'); // Debug log
    restoreFormData();
  }, []);

  // Restore form data when location changes (user returns from step 2)
  useEffect(() => {
    console.log('Location changed, restoring data...'); // Debug log
    restoreFormData();
  }, [location.pathname]);

  // Function to manually save form data
  const saveFormData = () => {
    if (form.username || form.email || form.password || form.confirmPassword) {
      console.log('Manually saving form data:', form);
      localStorage.setItem('registrationStep1Data', JSON.stringify(form));
    }
  };

  // Save form data when component unmounts or user navigates away
  useEffect(() => {
    return () => {
      saveFormData();
    };
  }, [form]);

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    // Only save if there's actual data to save
    if (form.username || form.email || form.password || form.confirmPassword) {
      console.log('Saving form data:', form); // Debug log
      localStorage.setItem('registrationStep1Data', JSON.stringify(form));
    }
  }, [form]);

  // Check if user has step 2 data to show progress indicator
  const [hasStep2Data, setHasStep2Data] = useState(false);
  
  useEffect(() => {
    const step2Data = localStorage.getItem('registrationStep2Data');
    if (step2Data) {
      try {
        const parsed = JSON.parse(step2Data);
        // Check if any profile fields have data
        const hasData = Object.values(parsed).some(value => value && value !== '');
        setHasStep2Data(hasData);
      } catch (error) {
        console.error('Error parsing step 2 data:', error);
      }
    }
  }, []);

  useEffect(() => {
    const password = form.password;
    const req = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
    setRequirements(req);

    let score = 0;
    Object.values(req).forEach(v => v && score++);
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    let feedback = ""; let color = "text-gray-400";
    if (score <= 2) { feedback = "Weak"; color = "text-red-500"; }
    else if (score <= 4) { feedback = "Fair"; color = "text-yellow-500"; }
    else if (score <= 6) { feedback = "Good"; color = "text-blue-500"; }
    else { feedback = "Strong"; color = "text-green-500"; }
    setPasswordStrength({ score, feedback, color });
  }, [form.password]);

  const validateUsername = (username) => {
    if (!username.trim()) return "Username is required";
    if (username.trim().length < 3) return "Username must be at least 3 characters long";
    if (username.trim().length > 20) return "Username must be less than 20 characters";
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) return "Username can only contain letters, numbers, and underscores";
    return null;
  };

  const validateEmail = (email) => {
    if (!email) return "Email is required";
    if (!email.includes('@')) return "Please include an '@' in the email address";
    if (!email.includes('.')) return "Please include a domain (e.g., .com)";
    if (email.length < 5) return "Email is too short";
    if (email.length > 100) return "Email is too long";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email address";
    return null;
  };

  const validatePassword = (password) => {
    if (!password) return "Password is required";
    if (password.length < 8) return "Password must be at least 8 characters long";
    if (password.length > 128) return "Password is too long";
    return null;
  };

  const validateConfirmPassword = (confirmPassword, password) => {
    if (!confirmPassword) return "Please confirm your password";
    if (confirmPassword !== password) return "Passwords do not match";
    return null;
  };

  const validateForm = () => {
    const errors = {};
    
    const usernameError = validateUsername(form.username);
    if (usernameError) errors.username = usernameError;
    
    const emailError = validateEmail(form.email);
    if (emailError) errors.email = emailError;
    
    const passwordError = validatePassword(form.password);
    if (passwordError) errors.password = passwordError;
    
    const confirmPasswordError = validateConfirmPassword(form.confirmPassword, form.password);
    if (confirmPasswordError) errors.confirmPassword = confirmPasswordError;
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFieldBlur = (fieldName) => {
    setFieldTouched(prev => ({ ...prev, [fieldName]: true }));
    
    // Validate specific field on blur
    if (fieldName === 'username') {
      const usernameError = validateUsername(form.username);
      setValidationErrors(prev => ({ ...prev, username: usernameError }));
    } else if (fieldName === 'email') {
      const emailError = validateEmail(form.email);
      setValidationErrors(prev => ({ ...prev, email: emailError }));
    } else if (fieldName === 'password') {
      const passwordError = validatePassword(form.password);
      setValidationErrors(prev => ({ ...prev, password: passwordError }));
    } else if (fieldName === 'confirmPassword') {
      const confirmPasswordError = validateConfirmPassword(form.confirmPassword, form.password);
      setValidationErrors(prev => ({ ...prev, confirmPassword: confirmPasswordError }));
    }
  };

  const handleFieldFocus = (fieldName) => {
    // Mark field as touched when user focuses on it
    setFieldTouched(prev => ({ ...prev, [fieldName]: true }));
  };

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    // Clear validation error when user starts typing
    if (validationErrors[e.target.name]) {
      setValidationErrors(prev => ({ ...prev, [e.target.name]: "" }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    
    // Mark all fields as touched so validation errors will show
    setFieldTouched({ username: true, email: true, password: true, confirmPassword: true });

    if (!validateForm()) {
      return;
    }

    // Check if user already exists before proceeding
    try {
      const { exists } = await authApi.checkUserExists(form.email);
      if (exists) {
        setValidationErrors(prev => ({ ...prev, email: "Email already exists. Please login instead." }));
        return;
      }
    } catch (err) {
      console.error("Failed to check user existence:", err);
      // Continue with registration if check fails
    }

    // Ensure form data is saved before proceeding
    saveFormData();

    try {
      await register({ username: form.username, email: form.email, password: form.password });
      if (hasStep2Data) {
        setSuccessMsg("Account created! Continuing to complete your profile...");
      } else {
        setSuccessMsg("Account created! Please complete your profile...");
      }
      setTimeout(() => navigate("/complete-profile"), 1200);
    } catch (err) {
      console.error("Registration failed:", err);
      // Handle specific registration errors
      if (err.message?.includes('username') || err.message?.includes('already exists')) {
        setValidationErrors(prev => ({ ...prev, username: "Username already exists" }));
      } else if (err.message?.includes('email') || err.message?.includes('already exists')) {
        setValidationErrors(prev => ({ ...prev, email: "Email already exists" }));
      }
    }
  };

  const handleSlideToLogin = () => {
    setShowLoginSlide(true);
    setTimeout(() => navigate("/login"), 550);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header (same style as Login) */}
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

        {/* Split layout with tatami slide overlay */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="relative w-full overflow-hidden rounded-2xl shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[620px]">
              {/* Left: CTA to login (now left side) */}
              <div className="relative hidden lg:block lg:order-1">
                <div className="absolute inset-0 bg-black/30"></div>
                <div className="relative h-full flex items-center justify-center p-8">
                  <div className="text-center text-white max-w-sm">
                    <h3 className="text-2xl font-semibold mb-2">Already have an account?</h3>
                    <p className="text-white/85 mb-6">Sign in to access your dashboard.</p>
                    
                    <button onClick={handleSlideToLogin} className="inline-flex items-center justify-center px-5 py-3 rounded-lg bg-white/95 text-gray-900 hover:bg-white transition">
                      Login
                      <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: Register form (moved to right side) */}
              <div className="relative bg-white/90 backdrop-blur p-8 flex items-center lg:order-2">
                <div className="w-full max-w-md mx-auto">
                  <h2 className="text-3xl font-extrabold text-gray-900 mb-1">Sign Up</h2>
                  <p className="text-gray-600 mb-6">Step 1 of 2: Create your account to get started</p>

                  {/* Simple Progress Bar */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                      <span>Step 1: Account Details</span>
                      <span>Step 2: Profile Information</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-gradient-to-r from-[#C3C3E5] to-[#A8A8D8] h-2 rounded-full transition-all duration-300" style={{ width: hasStep2Data ? '100%' : '50%' }}></div>
                    </div>
                  </div>

                  {/* Progress indicator and step 2 summary */}
                  {hasStep2Data && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center mb-3">
                        <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mr-2">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-sm font-medium text-green-800">Step 2 Progress Saved</span>
                      </div>
                      <p className="text-sm text-green-700 mb-2">Your profile information has been saved. You can continue from where you left off.</p>
                      <button
                        onClick={() => navigate('/complete-profile')}
                        className="text-sm text-green-600 hover:text-green-800 font-medium underline"
                      >
                        Continue to Step 2 →
                      </button>
                    </div>
                  )}

                  {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">{error}</div>
                  )}
                  {successMsg && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md">{successMsg}</div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                      <input
                        type="text"
                        name="username"
                        placeholder="Your name"
                        value={form.username}
                        onChange={handleChange}
                        onFocus={() => handleFieldFocus('username')}
                        onBlur={() => handleFieldBlur('username')}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#C3C3E5] focus:border-transparent ${
                          validationErrors.username ? 'border-red-500' : 'border-gray-300'
                        }`}
                        disabled={loading}
                        required
                      />
                      <div className="h-6 mt-1">
                        {validationErrors.username && fieldTouched.username && (
                          <p className="text-sm text-red-600">{validationErrors.username}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        name="email"
                        placeholder="you@example.com"
                        value={form.email}
                        onChange={handleChange}
                        onFocus={() => handleFieldFocus('email')}
                        onBlur={() => handleFieldBlur('email')}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-[#C3C3E5] focus:border-transparent ${
                          validationErrors.email ? 'border-red-500' : 'border-gray-300'
                        }`}
                        disabled={loading}
                        required
                      />
                      <div className="h-6 mt-1">
                        {validationErrors.email && fieldTouched.email && (
                          <p className="text-sm text-red-600">{validationErrors.email}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          name="password"
                          placeholder="••••••••"
                          value={form.password}
                          onChange={handleChange}
                          onFocus={() => handleFieldFocus('password')}
                          onBlur={() => handleFieldBlur('password')}
                          className={`w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-[#C3C3E5] focus:border-transparent ${
                            validationErrors.password ? 'border-red-500' : 'border-gray-300'
                          }`}
                          disabled={loading}
                          required
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600">
                          {showPassword ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/></svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                          )}
                        </button>
                      </div>
                      <div className="h-6 mt-1">
                        {validationErrors.password && fieldTouched.password && (
                          <p className="text-sm text-red-600">{validationErrors.password}</p>
                        )}
                      </div>

                      {form.password && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-600">Password strength</span>
                            <span className={`text-xs font-semibold ${passwordStrength.color}`}>{passwordStrength.feedback}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className={`${passwordStrength.score <= 2 ? "bg-red-500" : passwordStrength.score <= 4 ? "bg-yellow-500" : passwordStrength.score <= 6 ? "bg-blue-500" : "bg-green-500"} h-2 rounded-full transition-all duration-300`} style={{ width: `${(passwordStrength.score / 7) * 100}%` }}></div>
                          </div>
                        </div>
                      )}

                      {/* Password Requirements (original detailed) */}
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Password Requirements:</h4>
                        <div className="space-y-2">
                          <div className="flex items-center">
                            <div className={`${requirements.length ? "bg-green-500" : "bg-gray-300"} w-4 h-4 rounded-full mr-3 flex items-center justify-center`}>
                              {requirements.length && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <span className={`${requirements.length ? "text-green-700" : "text-gray-500"} text-sm`}>
                              At least 8 characters long
                            </span>
                          </div>
                          <div className="flex items-center">
                            <div className={`${requirements.uppercase ? "bg-green-500" : "bg-gray-300"} w-4 h-4 rounded-full mr-3 flex items-center justify-center`}>
                              {requirements.uppercase && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <span className={`${requirements.uppercase ? "text-green-700" : "text-gray-500"} text-sm`}>
                              One uppercase letter (A-Z)
                            </span>
                          </div>
                          <div className="flex items-center">
                            <div className={`${requirements.lowercase ? "bg-green-500" : "bg-gray-300"} w-4 h-4 rounded-full mr-3 flex items-center justify-center`}>
                              {requirements.lowercase && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <span className={`${requirements.lowercase ? "text-green-700" : "text-gray-500"} text-sm`}>
                              One lowercase letter (a-z)
                            </span>
                          </div>
                          <div className="flex items-center">
                            <div className={`${requirements.number ? "bg-green-500" : "bg-gray-300"} w-4 h-4 rounded-full mr-3 flex items-center justify-center`}>
                              {requirements.number && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <span className={`${requirements.number ? "text-green-700" : "text-gray-500"} text-sm`}>
                              One number (0-9)
                            </span>
                          </div>
                          <div className="flex items-center">
                            <div className={`${requirements.special ? "bg-green-500" : "bg-gray-300"} w-4 h-4 rounded-full mr-3 flex items-center justify-center`}>
                              {requirements.special && (
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <span className={`${requirements.special ? "text-green-700" : "text-gray-500"} text-sm`}>
                              One special character (!@#$%^&*)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Confirm password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          name="confirmPassword"
                          placeholder="••••••••"
                          value={form.confirmPassword}
                          onChange={handleChange}
                          onFocus={() => handleFieldFocus('confirmPassword')}
                          onBlur={() => handleFieldBlur('confirmPassword')}
                          className={`w-full px-4 py-3 pr-12 border rounded-lg focus:ring-2 focus:ring-[#C3C3E5] focus:border-transparent ${
                            validationErrors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                          }`}
                          disabled={loading}
                          required
                        />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600">
                          {showConfirmPassword ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"/></svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                          )}
                        </button>
                      </div>
                      <div className="h-6 mt-1">
                        {validationErrors.confirmPassword && fieldTouched.confirmPassword && (
                          <p className="text-sm text-red-600">{validationErrors.confirmPassword}</p>
                        )}
                      </div>
                    </div>
                    <button type="submit" className="w-full bg-gradient-to-r from-[#C3C3E5] to-[#A8A8D8] text-white py-3 rounded-lg font-medium hover:from-[#B8B8E0] hover:to-[#9D9DD3] focus:ring-2 focus:ring-[#C3C3E5] focus:ring-offset-2" disabled={loading}>
                      {loading ? "Creating account..." : "Create Account"}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* Full-screen slide overlay (covers entire container) */}
            <div className={`absolute inset-0 bg-white/95 backdrop-blur transform transition-transform duration-600 ease-out ${showLoginSlide ? "translate-x-0" : "-translate-x-full"}`} aria-hidden={!showLoginSlide}>
              <div className="h-full flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-[#C3C3E5] to-[#A8A8D8] mb-6 flex items-center justify-center">
                    <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c.943 0 1.714-.771 1.714-1.714S12.943 7.571 12 7.571 10.286 8.343 10.286 9.286 11.057 11 12 11z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.429 19.429a7.429 7.429 0 10-14.858 0" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">Taking you to Login</h3>
                  <p className="text-gray-600">Signing in to your account...</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default UserRegisterPage;
