import React, { useState } from 'react';
import { supabase } from "../supabaseClient";
import logo from "../assets/Logo.png";
import { useNavigate } from "react-router-dom"; // ganz oben ergänzen

const LoginPage = () => {
  const navigate = useNavigate(); // hier neu
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      console.log("Login erfolgreich:", data);
      setSuccessMessage('Login erfolgreich! Weiterleitung...');
      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);
    }
  };


  return (
    <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center px-4 text-white">
      <div className="w-full max-w-md bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-700">
        <div className="flex items-center gap-4 mb-8">
          <img src={logo} alt="SchichtPilot Logo" className="h-12" />
          <h1 className="text-2xl font-bold text-white">SchichtPilot Login</h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
              E-Mail-Adresse
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Passwort
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition disabled:opacity-50"
          >
            {loading ? 'Einloggen...' : 'Einloggen'}
          </button>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          {successMessage && <p className="text-green-500 text-sm text-center">{successMessage}</p>}
        </form>
        
<hr className="my-6 border-gray-600" />
<h2 className="text-center text-sm text-gray-400 mb-2 font-semibold">Entwicklungs-Anmeldetool</h2>

<button
  type="button"
  onClick={async () => {
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'f.k.h.@roehm.com',
      password: 'Felix',
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccessMessage('Admin-Login erfolgreich! Weiterleitung...');
      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);
    }
  }}
  className="w-full border border-gray-500 text-red-400 hover:text-white hover:bg-red-600 mt-1 py-2 rounded transition text-sm"
>
  Anmelden als Admin_Dev Röhm → BMA
</button>

<button
  type="button"
  onClick={async () => {
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'ugur@roehm.com',
      password: 'Ugur',
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccessMessage('Admin-Login erfolgreich! Weiterleitung...');
      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);
    }
  }}
  className="w-full border border-gray-500 text-red-400 hover:text-white hover:bg-red-600 mt-1 py-2 rounded transition text-sm"
>
  Anmelden als Employee Röhm → BMA
</button>

 <button
  type="button"
  onClick={async () => {
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'georg.klett@roehm.com',
      password: 'Georg',
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccessMessage('Admin-Login erfolgreich! Weiterleitung...');
      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);
    }
  }}
  className="w-full border border-gray-500 text-red-400 hover:text-white hover:bg-red-600 mt-1 py-2 rounded transition text-sm"
>
  Anmelden als Planner Röhm → BMA
</button> 
<button
  type="button"
  onClick={async () => {
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'stefan.koerfgen@roehm.com',
      password: 'Stefan',
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccessMessage('Admin-Login erfolgreich! Weiterleitung...');
      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);
    }
  }}
  className="w-full border border-gray-500 text-red-400 hover:text-white hover:bg-red-600 mt-1 py-2 rounded transition text-sm"
>
  Anmelden als Team_Leader Röhm → BMA
</button>      
<button
  type="button"
  onClick={async () => {
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'hans@roehm.com',
      password: 'Hans',
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccessMessage('Admin-Login erfolgreich! Weiterleitung...');
      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);
    }
  }}
  className="w-full border border-gray-500 text-red-400 hover:text-white hover:bg-red-600 mt-1 py-2 rounded transition text-sm"
>
  Anmelden als Org_Admin Röhm → BMA
</button> 
        <div className="mt-6 text-center text-gray-400 text-sm">
          © {new Date().getFullYear()} SchichtPilot
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
