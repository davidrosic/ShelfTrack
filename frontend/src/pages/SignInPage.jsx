import { useState } from "react";
import { useNavigate } from "react-router-dom";
import BookshelfIllustration from "../components/BookshelfIllustration";
import { GoogleIcon, AppleIcon } from "../components/Icons";
import Navbar from "../components/Navbar";

const SignInPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    remember: false,
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar showSearch={false} />
      <div className="flex flex-1">
      {/* Left - Light Form */}
      <div className="flex-1 flex flex-col justify-center px-12 lg:px-20 bg-white">
        <div className="max-w-md w-full mx-auto">
          <h1
            className="text-4xl font-bold mb-2"
            style={{ fontFamily: "'Playfair Display', serif", color: "#1C1C1C" }}
          >
            Welcome back!
          </h1>
          <p className="text-sm text-gray-500 mb-10">
            Enter your Credentials to access your account
          </p>

          <div className="space-y-5">
            <div>
              <label className="block text-sm text-gray-700 mb-1.5">Email address</label>
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-600 transition-colors"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm text-gray-700">Password</label>
                <button className="text-xs hover:underline" style={{ color: "#D4A574" }}>
                  forgot password
                </button>
              </div>
              <input
                type="password"
                placeholder="Password"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-600 transition-colors"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 mt-5 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 rounded accent-amber-700"
              checked={formData.remember}
              onChange={(e) => setFormData({ ...formData, remember: e.target.checked })}
            />
            <span className="text-xs text-gray-500">Remember for 30 days</span>
          </label>

          <button
            onClick={() => { onLogin?.(); navigate("/"); }}
            className="w-full py-3 rounded-lg text-white font-semibold text-sm mt-6 transition-all hover:brightness-110 active:scale-[0.98]"
            style={{ backgroundColor: "#8B7355" }}
          >
            Sign in
          </button>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div className="flex gap-3">
            <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <GoogleIcon /> Sign in with Google
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <AppleIcon /> Sign in with Apple
            </button>
          </div>

          <p className="text-center text-sm text-gray-500 mt-8">
            Don't have an account?{" "}
            <button
              onClick={() => navigate("/signup")}
              className="font-semibold hover:underline"
              style={{ color: "#D4A574" }}
            >
              Sign Up
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

export default SignInPage;
