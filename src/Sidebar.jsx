import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shapes, FileImage, FileSearch, HardDrive, FileSpreadsheet, MessageCircleQuestion } from 'lucide-react';

function Sidebar({ loading }) {
  const navigate = useNavigate();

  const navToHome = () => navigate('/');
  const navToImage = () => navigate('/image');
  const navToPDF = () => navigate('/pdf');

  const googleDriveUrl = 'https://drive.google.com/drive/folders/1c3odLY__uNMp1-FkP7bSDtaZ90K08riA?usp=sharing'; // Replace with your specific Drive URL
  const googleSheetsUrl = 'https://docs.google.com/spreadsheets/d/1wtaO0rdKW3WC1TBQBDRSUqQZ2t2yPsrHGnSeLJmr2pA/edit?usp=sharing'

  return (
    <div className="w-64 bg-gray-800 text-white h-full flex flex-col">
      <div className="p-4 text-lg font-bold">Navigation</div>

      <button onClick={navToImage} disabled={loading} className="m-2 flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700 transition-colors">
        <FileImage size={20} />
        Image
      </button>
      <button onClick={navToPDF} disabled={loading} className="m-2 flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700 transition-colors">
        <FileSearch size={20} />
        PDF
      </button>


      <div className="mt-auto p-4 gap-2 flex flex-row">
        <button
          className="flex items-center gap-2 w-full p-3 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors"
          onClick={() => window.open(googleDriveUrl, '_blank')}
          disabled={loading}
        >
          <HardDrive size={20} />
          Drive
        </button>

        <button
          className="flex items-center gap-2 w-full p-3 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors"
          onClick={() => window.open(googleSheetsUrl, '_blank')}
          disabled={loading}
        >
          <FileSpreadsheet size={20} />
          Sheets
        </button>

      </div>
    </div>
  );
}

export default Sidebar; 