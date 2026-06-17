import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import NewMatch from './pages/NewMatch';
import Scoring from './pages/Scoring';
import Scorecard from './pages/Scorecard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new" element={<NewMatch />} />
        <Route path="/match/:id" element={<Scoring />} />
        <Route path="/match/:id/scorecard" element={<Scorecard />} />
      </Routes>
    </BrowserRouter>
  );
}
