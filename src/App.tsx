import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Simulator from "./components/Simulator";
import Features from "./components/Features";
import Architecture from "./components/Architecture";
import CodeViewer from "./components/CodeViewer";
import SetupAndBuild from "./components/SetupAndBuild";
import Footer from "./components/Footer";

export default function App() {
  return (
    <div className="min-h-screen bg-void text-ink antialiased">
      <Navbar />
      <main>
        <Hero />
        <Simulator />
        <Features />
        <Architecture />
        <CodeViewer />
        <SetupAndBuild />
      </main>
      <Footer />
    </div>
  );
}
