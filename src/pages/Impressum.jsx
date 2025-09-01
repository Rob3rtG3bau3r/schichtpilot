import React from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { Link } from "react-router-dom";


const Impressum = () => (
  <div className="min-h-screen bg-gray-900 text-white flex flex-col">

          {/* Header */}
          <header className="w-full px-6 py-4 flex justify-between items-center border-b border-gray-700">
            <div className="flex items-center gap-3">
                        <Link to="/">
                <img src={logo} alt="SchichtPilot Logo" className="h-16 cursor-pointer" />
              </Link>
                 </div>
            <button
              onClick={() => navigate("/login")}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl text-sm"
            >
              Login
            </button>
          </header>
    
    {/* Inhalt */}
    <main className="flex-grow px-6 py-12 flex flex-col items-center">
      <div className="max-w-3xl w-full">
        <h1 className="text-3xl font-bold mb-6">Impressum</h1>
        <p className="font-semibold">Angaben gemäß § 5 TMG:</p>
        <p className="mt-4">
          Robert Gebauer<br />
          Kiefernweg 22<br />
          50389 Wesseling<br />
          Deutschland
        </p>
        <p className="font-bold mt-4">Kontakt:</p>
        <p>E-Mail: info@schichtpilot.com</p>
        <p className="mt-4">
          Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV:<br />
          Robert Gebauer, gleiche Anschrift wie oben
        </p>
      </div>
    </main>

    {/* Footer */}
    <footer className="text-center text-gray-500 text-xs py-4">
      © {new Date().getFullYear()} SchichtPilot ·{" "}
      <Link to="/" className="underline text-blue-400 hover:text-white">Zur Startseite</Link>{" "}
      | <Link to="/datenschutz" className="underline text-blue-400 hover:text-white">Datenschutzerklärung</Link>
    </footer>
  </div>
);

export default Impressum;


