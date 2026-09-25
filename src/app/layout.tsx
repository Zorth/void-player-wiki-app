import './globals.css';
import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'The Void Player Wiki',
  description: 'Official knowledge base and campaign documentation for The Void.',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/void_icon_purple.png', type: 'image/png' },
    ],
    shortcut: '/void_icon_purple.png',
    apple: '/void_icon_purple.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-obsidian-bg text-obsidian-text min-h-screen flex flex-col antialiased selection:bg-purple-900 selection:text-white">
        <Navbar />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-obsidian-border bg-obsidian-surface py-6 mt-16 text-center text-xs text-obsidian-textFaint">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span>The Void Player Wiki &middot; Maintained by Campaign Players</span>
            <div className="flex items-center space-x-4">
              <a href="https://guild.tarragon.be" target="_blank" rel="noreferrer" className="text-obsidian-purpleLight hover:underline">
                Guild Portal
              </a>
              <a href="https://discord.com/channels/878674783972261918/1322273585032724510" target="_blank" rel="noreferrer" className="text-obsidian-purpleLight hover:underline">
                #ouroboros_inn Discord
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
