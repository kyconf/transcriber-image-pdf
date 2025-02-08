import React, { useState, useEffect } from 'react';
import { Upload, Globe, Mic } from 'lucide-react';
import './loader.module.css';

function RWPage() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [inputText, setInputText] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) {
      alert('Please enter a valid prompt before submitting.');
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3000/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: inputText }),
      });
      
      if (response.ok) {
        await fetchPreview();
        setInputText('');
      } else {
        alert('Error submitting data.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPreview = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:3000/chat/response`);
      if (response.ok) {
        const data = await response.json();
        setPreview(data);
      } else {
        console.error('Failed to fetch:', response.statusText);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreview();
  }, []);

  return (
    <div className="h-full border-l flex-1 flex flex-col p-4 bg-gray-800 text-white">
      <header className="border-p border-gray-300 p-4">
        <h1 className="text-2xl font-semibold text-center">ChatGPT</h1>
      </header>

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

      {loading && (
        <div className="flex justify-center items-center h-16">
          <div className="loader"></div>
        </div>
      )}

      <div className="border-t border-gray-700 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="relative">
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Message ChatGPT"
                className="w-full bg-gray-700 rounded-lg pl-4 pr-32 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button className="p-2 hover:bg-gray-600 rounded-lg">
                  <Upload size={16} />
                </button>
                <button className="p-2 hover:bg-gray-600 rounded-lg">
                  <Globe size={16} />
                </button>
                <button className="p-2 hover:bg-gray-600 rounded-lg">
                  <Mic size={16} />
                </button>
                <button type="submit" className="p-2 bg-blue-500 hover:bg-blue-600 rounded-lg">
                  Submit
                </button>
              </div>
            </form>
          </div>
          <p className="text-xs text-center mt-2 text-gray-400">
            ChatGPT can make mistakes. Consider checking important info.
          </p>
        </div>
      </div>
    </div>
  );
}

export default RWPage;
