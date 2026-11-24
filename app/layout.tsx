import type { Metadata, Viewport } from 'next';
import './globals.css';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: { default: 'CityFix — See the problem. Report it. Reach the responsible authority.', template: '%s · CityFix' },
  description: 'CityFix lets Indian citizens photograph a civic problem, geotag it, identify the elected representative and department officer responsible, and generate a formal complaint letter — then track it to resolution.',
  openGraph: { title: 'CityFix — Citizen-Powered Civic Accountability', description: 'Photograph it. Geotag it. We identify the authority and draft the complaint.', type: 'website' },
};

export const viewport: Viewport = { themeColor: '#0d3a2d' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..900&family=Public+Sans:wght@400..800&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
