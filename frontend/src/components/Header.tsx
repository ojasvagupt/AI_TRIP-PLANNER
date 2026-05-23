import { Plane } from 'lucide-react';

export default function Header() {
  return (
    <header className="bg-gradient-to-r from-purple-600 to-blue-600 shadow-lg">
      <div className="max-w-6xl mx-auto px-4 py-6 flex items-center gap-3">
        <Plane className="w-8 h-8 text-white" />
        <h1 className="text-3xl font-bold text-white">AI Trip Planner</h1>
      </div>
    </header>
  );
}
