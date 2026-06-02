import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OMEC Connect',
  description: 'OMEC job dispatch and member access portal',
  openGraph: {
    images: [
      {
        url: "https://www.omecconnect.com/omec-og.png",
        width: 1200,
        height: 630,
        alt: "OMEC Connect"
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "OMEC Connect",
    description: "OMEC job dispatch and member access portal",
    images: ["https://www.omecconnect.com/omec-og.png"],
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
