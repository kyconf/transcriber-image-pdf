import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import RWPage from './RWPage'; // Assuming RWPage is your main component

import ImagePage from './ImagePage'; // Create an ImagePage component
import PDFPage from './PDFPage'; // Your existing PDFPage component
import Sidebar from './Sidebar'; // Import the Sidebar component
import Generate from './Generate';
// This is the first page, aka the login page
// to run app do npm run dev

function App() {
  return (
    <Router>
      <div className="flex h-screen"> {/* Ensure the container takes full height */}
        <Sidebar /> {/* Include the Sidebar here */}
        <div className="flex-1 overflow-auto"> {/* Allow scrolling if content overflows */}
          <Routes>
            <Route path="/" element={<RWPage />} />
            <Route path="/image" element={<ImagePage />} />
            <Route path="/pdf" element={<PDFPage />} />
            <Route path="/generate" element={<Generate />} />
          </Routes>

        </div>
      </div>
    </Router>
  );
}

export default App;
