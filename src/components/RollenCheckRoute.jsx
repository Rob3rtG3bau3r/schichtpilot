import { Navigate } from 'react-router-dom';
import { useRollen } from '../context/RollenContext';

const RollenCheckRoute = ({ erlaubteRollen, children }) => {
  const { rolle } = useRollen();

  if (!rolle) {
    return <Navigate to="/login" replace />;
  }

  if (!erlaubteRollen.includes(rolle)) {
    return <div className="text-red-600 p-6">Zugriff verweigert – keine Berechtigung.</div>;
  }

  return children;
};

export default RollenCheckRoute;

