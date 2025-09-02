import React, { useState } from 'react';
import LoadingOverlay from '../components/LoadingOverlay';

const LoadingDemo: React.FC = () => {
  const [showDefault, setShowDefault] = useState(false);
  const [showMinimal, setShowMinimal] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const [showSection, setShowSection] = useState(false);

  return (
    <div className="p-8 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Loading Overlay Demo
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Default Variant */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Default Spinner
            </h3>
            <button
              onClick={() => setShowDefault(true)}
              className="bg-discord-primary hover:bg-discord-primary/90 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Show Default Overlay
            </button>
            {showDefault && (
              <LoadingOverlay
                title="Loading Data..."
                message="Fetching your Discord server information"
                variant="default"
                fullHeight={true}
              />
            )}
          </div>

          {/* Minimal Variant */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Minimal Spinner
            </h3>
            <button
              onClick={() => setShowMinimal(true)}
              className="bg-discord-secondary hover:bg-discord-secondary/90 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Show Minimal Overlay
            </button>
            {showMinimal && (
              <LoadingOverlay
                title="Processing..."
                message="This won't take long"
                variant="minimal"
                fullHeight={true}
              />
            )}
          </div>

          {/* Pulse Variant */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Pulse Animation
            </h3>
            <button
              onClick={() => setShowPulse(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Show Pulse Overlay
            </button>
            {showPulse && (
              <LoadingOverlay
                title="Synchronizing..."
                message="Syncing with Discord servers"
                variant="pulse"
                fullHeight={true}
              />
            )}
          </div>

          {/* Section Overlay */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg relative min-h-[300px]">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Section Overlay
            </h3>
            <button
              onClick={() => setShowSection(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Show Section Overlay
            </button>
            <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <p className="text-gray-600 dark:text-gray-300">
                This is some content that will be covered by the overlay
              </p>
            </div>
            {showSection && (
              <LoadingOverlay
                title="Loading Section..."
                message="Loading this specific section"
                variant="default"
                fullHeight={false}
              />
            )}
          </div>
        </div>

        {/* Close buttons when overlays are shown */}
        {(showDefault || showMinimal || showPulse) && (
          <div className="fixed top-4 right-4 z-[60]">
            <button
              onClick={() => {
                setShowDefault(false);
                setShowMinimal(false);
                setShowPulse(false);
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Close Overlay
            </button>
          </div>
        )}

        {showSection && (
          <div className="mt-4">
            <button
              onClick={() => setShowSection(false)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Close Section Overlay
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingDemo;
