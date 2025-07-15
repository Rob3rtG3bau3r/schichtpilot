import { createContext, useContext, useState } from 'react';

const RollenContext = createContext();

export const RollenProvider = ({ children }) => {
  const [rolle, setRolle] = useState(null);
  const [nutzerName, setNutzerName] = useState('');
  const [istSuperAdmin, setIstSuperAdmin] = useState(false);
  const [sichtFirma, setSichtFirma] = useState(null);
  const [sichtUnit, setSichtUnit] = useState(null);
  const [userId, setUserId] = useState(null);

  return (
    <RollenContext.Provider value={{
      rolle, setRolle,
      nutzerName, setNutzerName,
      istSuperAdmin, setIstSuperAdmin,
      sichtFirma, setSichtFirma,
      sichtUnit, setSichtUnit,
      userId, setUserId,
    }}>
      {children}
    </RollenContext.Provider>
  );
};

export const useRollen = () => useContext(RollenContext);