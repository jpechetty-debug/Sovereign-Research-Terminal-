import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Screener } from './pages/Screener';
import { StockDetail } from './pages/StockDetail';
import { Universe } from './pages/Universe';
import { DataProvider } from './context/DataContext';

export default function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="screener" element={<Screener />} />
            <Route path="universe" element={<Universe />} />
            <Route path="stock/:ticker" element={<StockDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </DataProvider>
  );
}
