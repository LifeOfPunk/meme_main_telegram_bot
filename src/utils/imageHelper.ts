import fs from 'fs';
import path from 'path';

export function getWelcomeImagePath(): string | null {
  const p = path.resolve('data', 'welcome-screen.png');
  return fs.existsSync(p) ? p : null;
}
