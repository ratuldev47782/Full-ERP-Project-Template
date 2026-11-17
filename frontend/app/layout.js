import './globals.css';

export const metadata = {
  title: 'ERP Authentication',
  description: 'User registration and login for the ERP suite.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
