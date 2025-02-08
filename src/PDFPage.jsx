import React, { useState, useEffect } from 'react';
import './loader.module.css'; // Import the CSS file for the loader



function PDFPage() {
  const [loading, setLoading] = useState(false); // Track loading state

  const [transcriptionComplete, setTranscriptionComplete] = useState(false); // Track transcription completion
  const [showPopup, setShowPopup] = useState(false); // Control popup visibility


  const handleProcessPDFs = async () => {
    setLoading(true); // Set loading state
    try {
      const response = await fetch('http://localhost:3000/process-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        alert(data.message); // Show alert with the message from the backend
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.message || 'Error processing PDFs.'}`);
      }
    } catch (error) {
      console.error('Error processing PDFs:', error);
      alert('An error occurred while processing PDFs.');
    } finally {
      setLoading(false); // Reset loading state
    }
  };

  const closePopup = () => {
    setShowPopup(false); // Close the popup
  };

  return (
    <div className="h-full border-l flex-1 flex flex-col p-4 bg-gray-800 text-white">
      {/* Header */}
      <header className="border-p border-gray-300 p-4">
        <h1 className="text-2xl font-semibold text-center">PDF Transcription</h1>
      </header>
      


      {/* Process PDFs Button */}
      <div className="flex-1 flex justify-center items-center">
        <button
          onClick={handleProcessPDFs}
          disabled={loading} // Disable button while loading
          className={`p-4 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-500'} text-white rounded-lg text-xl hover:bg-blue-600 transition-colors`}
        >
          {loading ? 'Processing...' : 'TRANSCRIBE'}
        </button>
      </div>

      {/* Spinning Loader */}
      {loading && (
        <div className="flex justify-center items-center h-16">
          <div className="loader"></div>
        </div>
      )}

      {/* Preview Area */}
      <div className="flex-1 overflow-auto p-4">
        
          <div className="p-4 space-y-4">
         
          </div>
     
          <h1 className="text-center">Always check PDFs before processing!</h1>
      
      </div>

      {/* Popup Notification */}
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

export default PDFPage;
