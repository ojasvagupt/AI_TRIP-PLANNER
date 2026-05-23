import TripForm from "./components/TripForm"
import Itinerary from "./components/Itinerary"
import AgentChat from "./components/AgentChat"

function App() {

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#f8f5ed_0%,_#f2f0e8_35%,_#e7ece9_100%)] text-slate-800">
      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8 md:py-10">
        <div className="mb-8 flex items-end justify-between">
          <div className="micro-fade-up" style={{ animationDelay: "30ms" }}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
              Agentic Travel Studio
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
              AI Trip Planner
            </h1>
          </div>
          <p className="micro-fade-up micro-hover-lift hidden rounded-full border border-teal-200 bg-white/75 px-4 py-2 text-sm text-slate-600 transition duration-200 hover:bg-white md:block" style={{ animationDelay: "120ms" }}>
            Plan faster with form + AI chat copilot
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.7fr_1fr] micro-fade-up" style={{ animationDelay: "180ms" }}>
          <div className="space-y-6 micro-stagger">
            <TripForm />
            <Itinerary />
          </div>

          <div className="micro-fade-up" style={{ animationDelay: "240ms" }}>
            <AgentChat />
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
