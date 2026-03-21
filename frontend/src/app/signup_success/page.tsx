"use client";

import { Suspense } from "react";
import SignUpSuccess from "@/components/SignUpSuccess";

export default function SuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f9fa]">
      <Suspense fallback={<div>Loading...</div>}>
        <SignUpSuccess />
      </Suspense>
    </main>
  );
}
