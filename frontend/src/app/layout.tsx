import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";


// Configuration for Geist Fonts
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nyaya | Sri Lankan Legal Resource",
  description: "Your comprehensive Sri Lankan legal resource hub.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* 1. Applied the font variables to the body className 
          2. Added 'antialiased' for smoother text rendering
          3. 'min-h-screen' ensures the page takes up the full height
      */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 flex flex-col min-h-screen`}>
        
        {/* Universal Navigation Bar */}
        <Navbar />

        {/* 'flex-grow' ensures that if a page has very little content, 
            the Footer is still pushed to the bottom of the screen.
        */}
        <main className="flex-grow">
          {children}
        </main>

       
        
      </body>
    </html>
  );
}