"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/superadmin/Header";

export default function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="px-8 py-6">{children}</main>
    </div>
  );
}
