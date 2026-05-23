import { CheckCircle, AlertCircle, Loader } from 'lucide-react';

interface TripResultProps {
  response: string | null;
  error: string | null;
  loading: boolean;
}

export default function TripResult({ response, error, loading }: TripResultProps) {
  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
        <Loader className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
        <p className="text-white/70">Creating your personalized trip plan...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
        <div className="flex gap-3">
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
          <div>
            <h3 className="text-red-300 font-semibold mb-1">Error</h3>
            <p className="text-red-200/70">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!response) {
    return null;
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-8">
      <div className="flex gap-3 mb-4">
        <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
        <h2 className="text-2xl font-bold text-white">Your Trip Plan</h2>
      </div>
      <div className="prose prose-invert max-w-none">
        <div className="text-white/80 whitespace-pre-wrap leading-relaxed">
          {response}
        </div>
      </div>
    </div>
  );
}
