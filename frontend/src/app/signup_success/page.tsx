import SignupSuccess from "@/components/SignUpSuccess";

/**
 * In Next.js 15, searchParams is a Promise. 
 * We must await it to access the data passed from the SignUpForm.
 */
export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  // Awaiting the promise to extract user details
  const params = await searchParams;

  const firstName = params.firstName || "N/A";
  const surname = params.surname || "";
  const username = params.username || "N/A";
  const email = params.email || "N/A";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f9fa]">
      <SignupSuccess 
        firstName={firstName} 
        surname={surname} 
        username={username} 
        email={email} 
      />
    </main>
  );
}