"use client";

import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    router.push("/login");
  };

  return (
    <header className="flex items-center justify-between bg-black px-6 py-4 text-white">
      <div className="flex items-center gap-2 text-lg font-semibold">
        🏫 EduSystem SuperAdmin
      </div>

      <div className="flex items-center gap-6">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          Logout
        </button>

        <div className="h-8 w-8 rounded-full bg-white text-black flex items-center justify-center font-bold">
          SA
        </div>
      </div>
    </header>
  );
}