import { useState } from 'react';
import { tripAPI } from '../services/tripAPI';
import type { TripPlanResponse } from '../services/tripAPI';
import { Loader, MapPin, Calendar, Heart } from 'lucide-react';

export function TripPlanner() {
  const [destination, setDestination] = useState('');
  const [duration, setDuration] = useState(3);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['beaches', 'culture']);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TripPlanResponse | null>(null);

  const interestOptions = [
    'beaches',
    'culture',
    'adventure',
    'food',
    'nature',
    'history',
    'shopping',
    'nightlife',
  ];

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handlePlanTrip = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!destination.trim()) {
      alert('Please enter a destination');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await tripAPI.planTrip(destination, duration, selectedInterests);
      setResult(response);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            ✈️ AI Trip Planner
          </h1>
          <p className="text-xl text-gray-600">
            Get personalized travel itineraries powered by AI
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-lg p-8 sticky top-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Plan Your Trip</h2>

              <form onSubmit={handlePlanTrip} className="space-y-6">
                {/* Destination Input */}
                <div>
                  <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                    <MapPin className="w-5 h-5 mr-2 text-purple-600" />
                    Destination
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="e.g., Tokyo, Paris, Goa"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>

                {/* Duration Slider */}
                <div>
                  <label className="flex items-center text-sm font-semibold text-gray-700 mb-2">
                    <Calendar className="w-5 h-5 mr-2 text-purple-600" />
                    Trip Duration: {duration} days
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="14"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full"
                  />
                </div>

                {/* Interests */}
                <div>
                  <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                    <Heart className="w-5 h-5 mr-2 text-purple-600" />
                    Interests
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {interestOptions.map((interest) => (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => toggleInterest(interest)}
                        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                          selectedInterests.includes(interest)
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {interest}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Planning...
                    </>
                  ) : (
                    'Generate Itinerary'
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-2">
            {loading && (
              <div className="bg-white rounded-lg shadow-lg p-8 flex items-center justify-center min-h-96">
                <div className="text-center">
                  <Loader className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
                  <p className="text-lg text-gray-600">
                    AI is creating your perfect itinerary...
                  </p>
                  <p className="text-sm text-gray-500 mt-2">This may take up to a minute</p>
                </div>
              </div>
            )}

            {result && !loading && (
              <div className="bg-white rounded-lg shadow-lg p-8">
                {result.status === 'success' ? (
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                      Your {duration}-Day {destination} Itinerary
                    </h3>
                    <div className="prose prose-sm max-w-none">
                      <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                        {result.response}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 font-semibold">Error</p>
                    <p className="text-red-700">{result.error || 'Failed to generate itinerary'}</p>
                  </div>
                )}
              </div>
            )}

            {!result && !loading && (
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg border-2 border-dashed border-purple-300 p-8 flex items-center justify-center min-h-96">
                <div className="text-center">
                  <MapPin className="w-16 h-16 text-purple-400 mx-auto mb-4 opacity-50" />
                  <p className="text-lg text-gray-600">
                    Enter your destination and preferences to get started
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
