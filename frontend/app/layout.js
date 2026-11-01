// frontend/app/layout.js

import './globals.css';

export const metadata = {
  title: 'Attendance',
  description: 'ZKTeco attendance system',
  icons: {
    icon: '/HKD_LOGO.png',
    shortcut: '/HKD_LOGO.png',
    apple: '/HKD_LOGO.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/HKD_LOGO.png" type="image/png" />
      </head>
      <body>{children}</body>
    </html>
  );
}