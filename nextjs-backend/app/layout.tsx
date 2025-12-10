export const metadata = {
  title: 'Teleprompter Backend',
  description: 'JWT token service for voice-activated teleprompter',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
