import InputForm from "./components/InputForm";
import RiskForm from "./components/Riskform";
import PubMedSearch from "./components/PubMedSearch";

function App() {
  return (
    <div className="min-h-screen bg-white text-black">
      <header className="p-4 shadow bg-gray-100">
        <h1 className="text-3xl font-bold">SurgiAssist AI™</h1>
        <p className="text-sm text-gray-500">Your Surgical Copilot</p>
      </header>
      <main className="p-6 space-y-16">
        <InputForm />
        <hr className="my-12" />
        <RiskForm />
        <hr className="my-12" />
        //<PubMedSearch />
      </main>
    </div>
  );
}

export default App;