import { Nav } from './nav';

export function Shell({ children }) {
  return (
    <div class="min-h-screen bg-gray-50">
      <Nav />
      <main class="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
