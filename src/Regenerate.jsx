import React, { useState, useEffect } from 'react';
import './loader.module.css';
import { ComboboxDemo } from '@/components/ui/combobox';

function Regenerate() {
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [transcriptionComplete, setTranscriptionComplete] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [inputFields, setInputFields] = useState(['']);
  const [validationError, setValidationError] = useState('');

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

  const addInputField = () => {
    setInputFields([...inputFields, '']);
    setValidationError('');
  };

  const removeInputField = (index) => {
    const newInputFields = [...inputFields];
    newInputFields.splice(index, 1);
    setInputFields(newInputFields.length ? newInputFields : ['']);
    setValidationError('');
  };

  const handleInputChange = (index, value) => {
    // Allow only numbers
    const numericValue = value.replace(/[^0-9]/g, '');
    
    const newInputFields = [...inputFields];
    newInputFields[index] = numericValue;
    setInputFields(newInputFields);
    setValidationError('');
  };

  const validateInputs = () => {
    // Check for empty fields
    if (inputFields.some(field => field.trim() === '')) {
      setValidationError('All fields must be filled.');
      return false;
    }

    // Check for non-integer values (should be redundant due to input filtering)
    if (inputFields.some(field => isNaN(field) || !Number.isInteger(Number(field)))) {
      setValidationError('Only whole numbers (integers) are allowed.');
      return false;
    }

    // Check for duplicates
    const uniqueValues = new Set(inputFields);
    if (uniqueValues.size !== inputFields.length) {
      setValidationError('Duplicate values are not allowed.');
      return false;
    }

    return true;
  };

  const handleRegenerate = async () => {
    if (!selectedSheet) {
      alert('Please select a sheet first');
      return;
    }

    if (!validateInputs()) {
      return;
    }

    setLoading(true);
    try {
      for (const row of inputFields.map(Number)) {
        const response = await fetch('http://localhost:3000/regenerate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sheetName: selectedSheet,
            row: row
          })
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || `Failed to send row ${row} for regeneration`);
        }
      }

      alert(`Successfully sent rows: ${inputFields.join(', ')} for regeneration.`);
      setShowPopup(true);
      // Refresh sheet names to show the new sheet
      fetchSheetNames();
    } catch (error) {
      console.error('Error:', error);
      alert(`Error sending rows for regeneration: ${error.message}`);
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
          <h1 className="text-2xl font-semibold text-center">Regenerate Questions</h1>
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
        <h1 className="text-2xl font-semibold text-center">Regenerate Questions</h1>
      </header>

      <div className="flex-1 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md mb-8">
          <h3 className="text-xl font-medium mb-4 text-center text-blue-400">
            Enter rows to regenerate
          </h3>
          
          <div id="inputContainer">
            {inputFields.map((input, index) => (
              <div key={index} className="input-group flex items-center mb-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  className="input-box flex-grow p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-blue-500 focus:outline-none"
                  placeholder="Enter an integer"
                />
                {inputFields.length > 1 && (
                  <button
                    onClick={() => removeInputField(index)}
                    className="remove-btn bg-red-500 text-white border-none rounded-full w-7 h-7 text-sm ml-2 hover:bg-red-600 transition-colors"
                  >
                    ✖
                  </button>
                )}
              </div>
            ))}
          </div>
          
          {validationError && (
            <div className="text-red-400 mb-3 text-sm">{validationError}</div>
          )}
          
          <div className="action-buttons flex justify-center mt-4 mb-6">
            <button
              onClick={addInputField}
              className="button bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-colors mr-2"
            >
              + Add Input
            </button>
            <button
              onClick={handleRegenerate}
              className="button bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Submit
            </button>
          </div>

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

        {loading && (
          <div className="mt-4">
            <div className="loader"></div>
          </div>
        )}
      </div>

      {showPopup && (
        <div className="fixed bottom-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg flex items-center">
          <span>Regeneration completed successfully!</span>
          <button onClick={closePopup} className="ml-4 text-white font-bold">
            X
          </button>
        </div>
      )}
    </div>
  );
}

export default Regenerate;
