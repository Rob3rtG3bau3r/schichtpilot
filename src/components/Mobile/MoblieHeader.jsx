import React from 'react';
import logo from '../../assets/logo.png'; // Pfad ggf. anpassen

const MobileHeader = ({ title }) => {
  return (
    <div className="bg-gray-800 text-white rounded-t-xl px-4 py-3 flex items-center justify-center gap-2">
      <img src={logo} alt="Logo" className="h-6" />
      <h2 className="text-xl font-bold">{title}</h2>
    </div>
  );
};

export default MobileHeader;
