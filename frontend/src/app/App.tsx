import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './theme';
import { ProblemListPage } from '../features/problem-bank/ProblemListPage';

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="app-shell">
          <Routes>
            <Route path="/" element={<ProblemListPage />} />
            <Route path="*" element={<ProblemListPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
