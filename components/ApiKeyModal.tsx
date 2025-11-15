import React, { useState } from 'react';
import { useApiKey } from '../contexts/ApiKeyContext';
import { XIcon } from './icons';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const { apiKey, setApiKey } = useApiKey();
  const [localKey, setLocalKey] = useState(apiKey || '');

  const handleSave = () => {
    setApiKey(localKey.trim());
    onClose();
  };

  const handleClose = () => {
    // Reset local key to currently stored key on close without saving
    setLocalKey(apiKey || '');
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div 
        className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 transition-opacity"
        onClick={handleClose}
    >
      <div 
        className="relative max-w-md w-full space-y-6 p-8 bg-gray-800 rounded-xl shadow-lg"
        onClick={e => e.stopPropagation()}
      >
         <button onClick={handleClose} className="absolute top-4 right-4 text-gray-400 hover:text-white">
            <XIcon className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold text-white">Set Gemini API Key</h2>
        <p className="text-sm text-gray-400">
          Your API key is stored securely in your browser's local storage.
          You can get a key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Google AI Studio</a>.
        </p>
        <div>
          <label htmlFor="apiKeyInput" className="block text-sm font-medium text-gray-300 mb-1">
            API Key
          </label>
          <input
            id="apiKeyInput"
            type="password"
            value={localKey}
            onChange={(e) => setLocalKey(e.target.value)}
            className="w-full bg-gray-700 text-white rounded-lg border border-gray-600 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Enter your Gemini API Key"
          />
        </div>
        <button
          onClick={handleSave}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300"
        >
          Save Key
        </button>
      </div>
    </div>
  );
};

export default ApiKeyModal;
