import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function App() {
  const [message, setMessage] = useState("Núcleo Rust aguardando verificação.");
  const [error, setError] = useState("");

  async function checkBackend() {
    setError("");
    try {
      setMessage(await invoke<string>("greet", { name: "CIRANDA" }));
    } catch (cause) {
      setError(String(cause));
    }
  }

  return (
    <main className="shell">
      <section className="card" aria-labelledby="title">
        <p className="eyebrow">DESKTOP · TAURI V2</p>
        <h1 id="title">CIRANDA</h1>
        <p className="intro">Base local-first para orquestração de agentes de IA.</p>
        <button type="button" onClick={checkBackend}>Verificar núcleo Rust</button>
        <output aria-live="polite">{error || message}</output>
      </section>
    </main>
  );
}
