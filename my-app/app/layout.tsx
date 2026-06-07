import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Student Profile",
  description: "Student management page",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
