import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "ReflectionFeed",
  description: "A private feed that brings your notes, sermons and highlights back for reflection.",
};

/** The root layout. Styling arrives with the real design; the spike only proves the path works. */
export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Georgia, serif", maxWidth: 680, margin: "2rem auto", padding: "0 1rem" }}>
        {children}
      </body>
    </html>
  );
}
