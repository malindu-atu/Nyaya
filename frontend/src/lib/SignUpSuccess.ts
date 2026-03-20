"use client";

import { useSearchParams } from 'next/navigation';

export function useSignUpSuccessLogic() {
  const searchParams = useSearchParams();

  // Extract values from the URL query parameters
  const firstName = searchParams.get('firstName') || "User";
  const surname = searchParams.get('surname') || "";
  const username = searchParams.get('username') || "N/A";
  const email = searchParams.get('email') || "N/A";

  return {
    firstName,
    surname,
    username,
    email
  };
}