import Providers from "./providers";
import './globals.css' // MUST be imported at the top
import { ReactNode } from "react";
import {Courier_Prime} from 'next/font/google'
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
        
      </body>
    </html>
  );
}