import { useState, useEffect } from 'react';
import Header from '../components/Header';
import SearchForm from '../components/SearchForm';
import TripResult from '../components/TripResult';
import { tripAPI } from '../services/tripAPI';
import { MapPin } from 'lucide-react';

export default function Home() {
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [destination, setDestination] = useState('');

  useEffect(() => {
    // Check API health on mount
    tripAPI.getHealth().catch(() => {
      console.warn('API health check failed');
    });
  }, []);

  const handleSearch = async (dest: string) => {
    setDestination(dest);
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await tripAPI.planTrip(dest, 3, ['sightseeing', 'food']);
      
      if (result.status === 'success') {
        setResponse(result.response);
      } else {
        setError(result.error || 'Failed to generate trip plan');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to connect to the API. Make sure the backend is running.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <Header />
      
      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <MapPin className="w-12 h-12 text-purple-400" />
          </div>
          <h2 className="text-4xl font-bold text-white mb-2">Plan Your Perfect Trip</h2>
          <p className="text-white/60 text-lg max-w-2xl mx-auto">
            Get personalized travel recommendations powered by AI. Just tell us where you want to go!
          </p>
        </div>

        {/* Search Form */}
        <div className="flex justify-center mb-12">
          <SearchForm onSearch={handleSearch} loading={loading} />
        </div>

        {/* Recent Search Info */}
        {destination && (
          <div className="text-center mb-6">
            <p className="text-white/50">Planning trip to: <span className="text-purple-400 font-semibold">{destination}</span></p>
          </div>
        )}

        {/* Trip Result */}
        <TripResult response={response} error={error} loading={loading} />

        {/* Empty State */}
        {!response && !error && !loading && (
          <div className="text-center text-white/40 py-12">
            <p>Enter a destination above to get started!</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-16 py-6 text-center text-white/40 text-sm">
        <p>AI Trip Planner © 2026 - Powered by Ollama</p>
      </footer>
    </div>
  );
}
