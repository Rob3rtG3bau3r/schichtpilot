{modalOffen && (
  <div
    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in"
    onClick={() => setModalOffen(false)}
  >
    <div
      className="bg-white dark:bg-gray-900 text-black dark:text-white rounded-xl p-6 w-[90%] max-w-lg shadow-2xl relative animate-fade-in"
      onClick={(e) => e.stopPropagation()}
    >
      <h2 className="text-lg font-bold mb-4">Modal Titel</h2>
      <p className="text-sm mb-4">
        Hier kommt dein Inhalt rein – mit sauberem Dark- und Light-Mode.
      </p>

      <button
        onClick={() => setModalOffen(false)}
        className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
      >
        Schließen
      </button>
    </div>
  </div>
)}
