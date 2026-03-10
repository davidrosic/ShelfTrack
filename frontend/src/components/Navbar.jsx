import { useNavigate } from "react-router-dom";
import { SearchIcon } from "./Icons";

const Navbar = ({ showSearch = true }) => {
  const navigate = useNavigate();

  return (
    <nav className="px-6 lg:px-12 py-4 border-b border-gray-100">
      {/* Top row: logo + search (desktop) + buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <span className="text-lg font-bold" style={{ color: "#1C1C1C" }}>
            shelf<span style={{ color: "#D4A574" }}>Track</span>
          </span>
        </div>

        {/* Desktop search bar */}
        {showSearch && (
          <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
            <div className="flex items-center w-full px-4 py-2 rounded-full border border-gray-200 bg-gray-50">
              <SearchIcon />
              <input
                type="text"
                placeholder="Need help finding your book?"
                className="ml-2 flex-1 bg-transparent text-sm text-gray-600 placeholder-gray-400 focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/signin")}
            className="px-5 py-2 text-sm font-medium rounded-full transition-colors hover:bg-gray-100"
            style={{ color: "#1C1C1C" }}
          >
            Sign in
          </button>
          <button
            onClick={() => navigate("/signup")}
            className="px-5 py-2 text-sm font-medium text-white rounded-full transition-all hover:brightness-110"
            style={{ backgroundColor: "#8B7355" }}
          >
            Sign up
          </button>
        </div>
      </div>

      {/* Mobile search bar — second row */}
      {showSearch && (
        <div className="flex md:hidden mt-3 items-center px-4 py-2 rounded-full border border-gray-200 bg-gray-50">
          <SearchIcon />
          <input
            type="text"
            placeholder="Need help finding your book?"
            className="ml-2 flex-1 bg-transparent text-sm text-gray-600 placeholder-gray-400 focus:outline-none"
          />
        </div>
      )}
    </nav>
  );
};

export default Navbar;
