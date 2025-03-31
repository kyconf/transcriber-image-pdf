import React, { useState, useEffect } from 'react';
import './loader.module.css';

function ImagePage() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [transcriptionComplete, setTranscriptionComplete] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

  const handleTranscribe = async () => {
    setLoading(true);
    setTranscriptionComplete(false);
    try {
      const response = await fetch(`http://localhost:3000/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        setProcessedCount(data.details.processed_files.length);
        setTranscriptionComplete(true);
        setShowPopup(true);
        console.log(`Processed ${data.details.processed_files.length} files successfully`);
      } else {
        setShowPopup(false);
        alert(`Could not process files: ${data.message}`);
      }
    } catch (error) {
      console.error('Error:', error);
      setShowPopup(false);
      alert('Could not complete the process. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const closePopup = () => {
    setShowPopup(false);
  };

  return (
    <div className="h-full border-l flex-1 flex flex-col p-4 bg-gray-800 text-white">
      <header className="border-p border-gray-300 p-4">
        <h1 className="text-2xl font-semibold text-center">Image Transcription</h1>
      </header>

      <div className="flex-1 flex justify-center items-center">
        <button
          onClick={handleTranscribe}
          disabled={loading}
          className={`p-4 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500'} text-white rounded-lg text-xl hover:bg-blue-600 transition-colors font-bold`}
        >
          {loading ? 'Transcribing...' : 'TRANSCRIBE IMAGES'}
        </button>
      </div>

      {loading && (
        <div className="flex justify-center items-center h-16">
          <div className="loader"></div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        <div className="p-4 space-y-4">
          <div className="flex justify-end">
            <div className="flex justify-start mt-4">
            </div>
          </div>
          <h1 className="text-center">Always check Images before processing!</h1>
        </div>
      </div>

      {showPopup && transcriptionComplete && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg flex items-center space-x-4">
          <span>✅ Successfully processed {processedCount} images!</span>
          <button onClick={closePopup} className="text-white hover:text-gray-200 font-bold">
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default ImagePage;
