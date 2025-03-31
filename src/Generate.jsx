import React, { useState, useEffect } from 'react';
import './loader.module.css';
import { ComboboxDemo } from '@/components/ui/combobox';

function Generate() {
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [transcriptionComplete, setTranscriptionComplete] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState('');

  useEffect(() => {
    fetchSheetNames();
  }, []);

  const fetchSheetNames = async () => {
    try {
      const response = await fetch('http://localhost:3000/sheet-names');
      const data = await response.json();
      
      if (data.success) {
        setSheetNames(data.sheetNames);
        if (data.sheetNames.length > 0) {
          setSelectedSheet(data.sheetNames[0]);
        }
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Error fetching sheet names:', error);
      setError('Failed to load sheet names');
    } finally {
      setLoading(false);
    }
  };

  const handleSheetChange = (event) => {
    setSelectedSheet(event.target.value);
  };

  const handleTranscribe = async () => {
    if (!selectedSheet) {
      alert('Please select a sheet first');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/download-sheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetName: selectedSheet
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(`Successfully downloaded sheet: ${selectedSheet} to Google Drive`);
        setShowPopup(true);
      } else {
        throw new Error(data.error || 'Failed to download sheet');
      }
    } catch (error) {
      console.error('Error:', error);
      alert(`Error downloading sheet: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedSheet) {
      alert('Please select a sheet first');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetName: selectedSheet,
          generate_prompt: generatePrompt
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        alert(`Successfully generated questions in new sheet: ${data.newSheetName}`);
        setShowPopup(true);
        // Refresh sheet names to show the new sheet
        fetchSheetNames();
      } else {
        throw new Error(data.error || 'Failed to generate questions');
      }
    } catch (error) {
      console.error('Error:', error);
      alert(`Error generating questions: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const closePopup = () => {
    setShowPopup(false);
  };

  // Filter sheet names based on search term
  const filteredSheetNames = sheetNames.filter(name =>
    name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && !sheetNames.length) {
    return (
      <div className="h-full border-l flex-1 flex flex-col p-4 bg-gray-800 text-white">
        <header className="border-b border-gray-300 p-4">
          <h1 className="text-2xl font-semibold text-center">Generate Questions</h1>
        </header>
        <div className="flex-1 flex justify-center items-center">
          <div className="loader"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="h-full border-l flex-1 flex flex-col p-4 bg-gray-800 text-white">
      <header className="border-b border-gray-300 p-4">
        <h1 className="text-2xl font-semibold text-center">Generate Questions</h1>
      </header>

      <div className="flex-1 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md mb-8">
          <label className="block text-sm font-medium mb-2 text-center">
            Select Sheet:
          </label>
          <div className="flex justify-center">
            <ComboboxDemo 
              sheetNames={sheetNames}
              selectedSheet={selectedSheet}
              onSheetSelect={(sheet) => setSelectedSheet(sheet)}
            />
          </div>
        </div>
        
        <div className="w-full max-w-md mb-8">
          <label className="block text-sm font-medium mb-2 text-center">
            Generation Prompt:
          </label>
          <textarea
            value={generatePrompt}
            onChange={(e) => setGeneratePrompt(e.target.value)}
            className="w-full p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-green-500 focus:outline-none"
            rows={4}
            placeholder="Enter your generation prompt here..."
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className={`p-4 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500'} text-white rounded-lg text-xl hover:bg-green-600 transition-colors font-bold`}
        >
          {loading ? 'Generating...' : 'GENERATE QUESTIONS'}
        </button>

        {loading && (
          <div className="mt-4">
            <div className="loader"></div>
          </div>
        )}
      </div>

      {showPopup && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg flex items-center">
          <span>Generation completed successfully!</span>
          <button onClick={closePopup} className="ml-4 text-white font-bold">
            X
          </button>
        </div>
      )}
    </div>
  );
}

export default Generate;
