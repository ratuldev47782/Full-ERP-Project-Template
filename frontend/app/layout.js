import './globals.css';

export const metadata = {
  title: 'ERP Authentication',
  description: 'User registration and login for the ERP suite.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-zinc-100 text-zinc-900 antialiased selection:bg-teal-700/20">{children}</body>
    </html>
  );
}