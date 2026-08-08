import './globals.css';

export const metadata = {
  title: {
    default: 'Test Material Warehouse',
    template: '%s | Test Material Warehouse',
  },
  description:
    'Test Material Warehouse management system for garments factories - inventory, suppliers and QA test tracking.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
