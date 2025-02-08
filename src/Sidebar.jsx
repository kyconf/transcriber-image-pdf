import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HardDrive, FileSpreadsheet } from 'lucide-react';

function Sidebar() {
  const navigate = useNavigate();

  const navToHome = () => navigate('/');
  const navToImage = () => navigate('/image');
  const navToPDF = () => navigate('/pdf');

  // Define the URLs for Google Drive and Google Sheets
  const googleDriveUrl = 'https://drive.google.com/drive/u/0/folders/18eZjKBriTAzfnRaXcl0vII8qyouDBfCI'; // Replace with your specific Drive URL
  const googleSheetsUrl = 'https://docs.google.com/spreadsheets/d/1-GMTSImDqWFahWiWU44iV108cfAN6UZc_QxaT08sTlE/edit?usp=sharing'; // Replace with your specific Sheets URL

  return (
    <div className="w-64 bg-gray-800 text-white h-full flex flex-col">
      <div className="p-4 text-lg font-bold">Navigation</div>
      <button onClick={navToHome} className="m-2 flex items-center gap-2 p-3 rounded-lg hover:bg-gray-700 transition-colors">
        Question 
      </button>
      <button onClick={navToImage} className="m-2 flex items-center gap-2 p-3 rounded-lg hover:bg-gray-700 transition-colors">
        Image
      </button>
      <button onClick={navToPDF} className="m-2 flex items-center gap-2 p-3 rounded-lg hover:bg-gray-700 transition-colors">

        PDF
      </button>
      <div className="mt-auto p-4 gap-2 flex flex-row">

      <button
        className="flex items-center gap-2 w-full p-3 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors"
        onClick={() => window.open(googleDriveUrl, '_blank')}
      >
        <HardDrive size={20} />
        Drive
      </button>

        
      <button
        className="flex items-center gap-2 w-full p-3 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors"
        onClick={() => window.open(googleSheetsUrl, '_blank')}
      >
        <FileSpreadsheet size={20} />
        Sheets
      </button>


      </div>
    </div>
  );
}

export default Sidebar; 