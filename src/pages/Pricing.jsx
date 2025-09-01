import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import logo from '../assets/logo.png';

const pakete = [
  {
    name: 'Basic',
    zielgruppe: 'Ideal für kleine Teams',
    funktionen: [
      'Schichtplanung',
      'Mobile Ansicht',
      'Urlaubsanträge',
      'Freiwünsche',
    ],
  },
  {
    name: 'Plus',
    zielgruppe: 'Für Betriebe mit Planer-Struktur',
    funktionen: [
      'Alles aus Basic',
      'Qualifikationslogik',
      'Bedarfsanalyse',
      'Dienständerung mit Verlauf',
    ],
  },
  {
    name: 'Enterprise',
    zielgruppe: 'Für größere Unternehmen & Gruppen',
    funktionen: [
      'Alles aus Plus',
      'Onboarding & Support',
      'Schnittstellen & Exporte',
      'Individuelle Anpassung',
    ],
  },
];

const Pricing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center">
      {/* Header */}
      <header className="w-full px-6 py-4 flex justify-between items-center border-b border-gray-700">
        <div className="flex items-center gap-3">
          <img src={logo} alt="SchichtPilot Logo" className="h-16 cursor-pointer" onClick={() => navigate('/')} />
        </div>
        <button
          onClick={() => navigate("/login")}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl text-sm"
        >
          Login
        </button>
      </header>

      {/* Hauptbereich */}
      <section className="mt-12 text-center px-6 max-w-4xl">
        <h1 className="text-4xl font-bold mb-4">Faire Preise – abgestimmt auf Ihren Bedarf</h1>
        <p className="text-lg text-gray-300 mb-10">
          Ob kleines Team oder großer Betrieb – der SchichtPilot passt sich Ihrer Struktur an.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {pakete.map((paket, idx) => (
            <div key={idx} className="bg-gray-800 rounded-2xl p-6 shadow text-left">
              <h2 className="text-xl font-bold mb-2">{paket.name}</h2>
              <p className="text-gray-400 mb-4">{paket.zielgruppe}</p>
              <ul className="mb-6 space-y-2">
                {paket.funktionen.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-gray-300">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-[2px]" /> <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate('/')} // Optional: Modal oder Kontaktseite
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-xl"
              >
                Angebot anfordern
              </button>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm text-gray-400">
          Preise individuell je nach Betriebsgröße und Funktionsumfang. Sprechen Sie uns an – wir erstellen ein passendes Angebot.
        </p>
      </section>

      {/* Footer */}
      <footer className="mt-20 mb-6 text-gray-500 text-xs text-center">
        © {new Date().getFullYear()} SchichtPilot ·{" "}
        <a href="/impressum" className="underline text-blue-400 hover:text-white">Impressum</a> ·{" "}
        <a href="/datenschutz" className="underline text-blue-400 hover:text-white">Datenschutz</a>
      </footer>
    </div>
  );
};

export default Pricing;
