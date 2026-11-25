import React from 'react';
import { Loader2 } from 'lucide-react';

export const Loading = ({ text, message, fullScreen = false }) => {
  const displayText = text || message || 'Loading system data...';
  if (fullScreen) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-gov-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-700">{displayText}</p>
      </div>
    );
  }

  return (
    <div className="py-12 flex flex-col items-center justify-center space-y-3">
      <Loader2 className="w-8 h-8 text-gov-primary animate-spin" />
      <span className="text-sm font-medium text-slate-600">{displayText}</span>
    </div>
  );
};

export default Loading;
