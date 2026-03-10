import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BookshelfIllustration from "../components/BookshelfIllustration";
import { GoogleIcon, AppleIcon } from "../components/Icons";
import Navbar from "../components/Navbar";

const SignUpPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    agreeTerms: false,
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar showSearch={false} />
      <div className="flex flex-1">
      {/* Left - Dark Form */}
      <div
        className="flex-1 flex flex-col justify-center px-12 lg:px-20"
        style={{ backgroundColor: "#1C1C1C" }}
      >
        <div className="max-w-md w-full mx-auto">
          <h1
            className="text-4xl font-bold text-white mb-10"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Get Started Now
          </h1>

          <div className="space-y-5">
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Name</label>
              <input
                type="text"
                placeholder="Enter your name"
                className="w-full px-4 py-3 rounded-lg border text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-600 transition-colors"
                style={{ backgroundColor: "transparent", borderColor: "#3a3a3a" }}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Email address</label>
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full px-4 py-3 rounded-lg border text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-600 transition-colors"
                style={{ backgroundColor: "transparent", borderColor: "#3a3a3a" }}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Password</label>
              <input
                type="password"
                placeholder="Password"
                className="w-full px-4 py-3 rounded-lg border text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-600 transition-colors"
                style={{ backgroundColor: "transparent", borderColor: "#3a3a3a" }}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 mt-5 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded accent-amber-700"
              checked={formData.agreeTerms}
              onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
            />
            <span className="text-xs text-gray-400">I agree to the terms & policy</span>
          </label>

          <button
            onClick={() => { onLogin?.(); navigate("/"); }}
            className="w-full py-3 rounded-lg text-white font-semibold text-sm mt-6 transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ backgroundColor: "#8B7355" }}
          >
            Signup
          </button>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-xs text-gray-500">or</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          <div className="flex gap-3">
            <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800 transition-colors">
              <GoogleIcon /> Sign in with Google
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800 transition-colors">
              <AppleIcon /> Sign in with Apple
            </button>
          </div>

          <p className="text-center text-sm text-gray-400 mt-8">
            Have an account?{" "}
            <button
              onClick={() => navigate("/signin")}
              className="font-semibold hover:underline"
              style={{ color: "#D4A574" }}
            >
              Sign In
            </button>
          </p>
        </div>
      </div>

      {/* Right - Illustration */}
      <div
        className="hidden lg:flex flex-1 items-center justify-center"
        style={{ backgroundColor: "#E8D5B7" }}
      >
        <BookshelfIllustration />
      </div>
      </div>
    </div>
  );
};

export default SignUpPage;
