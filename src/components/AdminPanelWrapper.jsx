import React from 'react';
import ReactDOM from 'react-dom';

const AdminPanelWrapper = ({ children }) => {
  return ReactDOM.createPortal(
    <div className="fixed top-2 right-80 z-50">{children}</div>,
    document.body
  );
};

export default AdminPanelWrapper;
