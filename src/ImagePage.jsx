import React, { useState, useEffect } from 'react';
import './loader.module.css';

function ImagePage() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [transcriptionComplete, setTranscriptionComplete] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

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

      if (response.ok) {
        await fetchPreview();
        setTranscriptionComplete(true);
        setShowPopup(true);
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.message || 'Error submitting data.'}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An unexpected error occurred. Please try again.');
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
          className={`p-4 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500'} text-white rounded-lg text-xl hover:bg-blue-600 transition-colors`}
        >
          {loading ? 'Transcribing...' : 'TRANSCRIBE'}
        </button>
      </div>

      {loading && (
        <div className="flex justify-center items-center h-16">
          <div className="loader"></div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        {preview && preview.length > 0 ? (
          <div className="p-4 space-y-4">
            {preview.map((entry, index) => (
              <div key={index}>
                <div className="flex justify-end">
                  <div className="text-base inline-block bg-blue-500 text-white p-3 rounded-lg">
                    {entry.user_prompt}
                  </div>
                </div>
                <div className="flex justify-start mt-4">
                  <div
                    className="text-base inline-block bg-gray-700 text-white p-3 rounded-lg"
                    dangerouslySetInnerHTML={{
                      __html: entry.response
                        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                        .replace(/\*(.*?)\*/g, '<i>$1</i>')
                        .replace(/__(.*?)__/g, '<u>$1</u>')
                        .replace(/\n/g, '<br>')
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <h1 className="text-center">No data available. Submit a new prompt!</h1>
        )}
      </div>

      {showPopup && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg flex items-center">
          <span>Transcription completed successfully!</span>
          <button onClick={closePopup} className="ml-4 text-white font-bold">
            X
          </button>
        </div>
      )}
    </div>
  );
}

export default ImagePage;
