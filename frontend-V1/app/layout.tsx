import Providers from "./providers";
import './globals.css' // MUST be imported at the top
import { ReactNode } from "react";
import {Courier_Prime} from 'next/font/google'
import { Toaster } from "react-hot-toast";
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
           <Toaster position="top-center" reverseOrder={false} />
        {children}
        </Providers>
        
      </body>
    </html>
  );
}