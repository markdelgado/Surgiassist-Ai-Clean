import "./App.css";
import InputForm from "./components/InputForm";
import RiskForm from "./components/Riskform";
import PubMedSearch from "./components/PubMedSearch";

function App() {
  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero__background" aria-hidden />
        <div className="hero__content container">
          <span className="hero__badge">SurgiAssist AI™</span>
          <h1 className="hero__title">A faster handoff between clinic and OR</h1>
          <p className="hero__subtitle">
            Generate surgical notes, quantify risk, and surface literature insights without leaving your workflow.
          </p>
          <div className="hero__cta">
            <div>
              <span className="hero__stat">Minutes saved</span>
              <strong>15+</strong>
            </div>
            <div>
              <span className="hero__stat">Supported specialities</span>
              <strong>12</strong>
            </div>
            <div>
              <span className="hero__stat">Clinicians onboard</span>
              <strong>480</strong>
            </div>
          </div>
        </div>
      </header>

      <main className="main-sections container">
        <InputForm />
        <RiskForm />
        <PubMedSearch />
      </main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <p>© {new Date().getFullYear()} SurgiAssist AI. Built for smarter surgical teams.</p>
          <a href="mailto:team@surgiassist.ai">team@surgiassist.ai</a>
        </div>
      </footer>
    </div>
  );
}

export default App;
