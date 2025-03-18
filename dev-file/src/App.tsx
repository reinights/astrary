import { useState } from "react";
import "./App.css";

function App() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <main className="screen">
      <button className="chatToggle" onClick={() => setIsOpen(true)}>
        ☰
      </button>

      <div className={`chatbot ${isOpen ? "open" : ""}`}>
        <div className="chatHeader">
          Chatbot Header
          <button className="buttonClose" onClick={() => setIsOpen(false)}>✖</button>
        </div>
        <div className="chatBody">Chatbot Messages & Input</div>
      </div>

      {isOpen && <div className="overlay" onClick={() => setIsOpen(false)}></div>}

      <div className="mode">Modes</div>
    </main>
  );
}

export default App;
