import { createFileRoute } from "@tanstack/react-router";
import WeatherWidget from "@/components/WeatherWidget";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Club Ciclista Riaza — Meteorología para rutas" },
      {
        name: "description",
        content:
          "Previsión meteorológica de Riaza para planificar tus salidas en bici: tiempo actual, próximos 5 días e indicador ciclista.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50/40 to-background">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <header className="mb-8">
          <div className="text-xs uppercase tracking-widest text-sky-700 font-semibold">
            Club Ciclista Riaza
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mt-1">
            Dashboard del club
          </h1>
        </header>
        <WeatherWidget />
      </div>
    </div>
  );
}
