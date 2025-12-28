const LoadingModal = ({ isOpen, message = "Processing..." }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Blurred background overlay */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      
      {/* Modal container */}
      <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 transform transition-all duration-300 scale-100 animate-in fade-in-0 zoom-in-95">
        {/* Loading spinner */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            Completing Your Profile
          </h3>
          <p className="text-gray-600 text-lg leading-relaxed">
            {message}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -top-2 -left-2 w-4 h-4 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full opacity-20" />
        <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-gradient-to-br from-blue-400 to-blue-500 rounded-full opacity-20" />
      </div>
    </div>
  );
};

export default LoadingModal;
