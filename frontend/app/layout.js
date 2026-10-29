// frontend/app/layout.js

import './globals.css';

export const metadata = { title: 'Attendance', description: 'ZKTeco attendance system' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}