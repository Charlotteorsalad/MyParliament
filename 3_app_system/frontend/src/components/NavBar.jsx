import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks";

function NavBar() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();



  const handleUserClick = () => {
    if (isAuthenticated) {
      navigate("/profile");
    } else {
      navigate("/login");
    }
  };

  const displayText = isAuthenticated ? "Profile" : "Login";

  return (
    <nav className="bg-purple-800 text-white sticky top-0 z-50 shadow w-full">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        <h1 className="text-xl font-bold">
          <Link to="/">MyParliament</Link>
        </h1>
        
        <div className="flex space-x-6 text-sm">
          <button
            onClick={handleUserClick}
            className="hover:underline focus:outline-none"
          >
            {displayText}
          </button>
        </div>
      </div>
    </nav>
  );
}

export default NavBar;
