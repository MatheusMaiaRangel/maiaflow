"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", textAlign: "center" }}>
        <h1>Algo deu errado</h1>
        <p>Ocorreu um erro inesperado. Tente novamente.</p>
        <button onClick={reset}>Tentar novamente</button>
      </body>
    </html>
  );
}
