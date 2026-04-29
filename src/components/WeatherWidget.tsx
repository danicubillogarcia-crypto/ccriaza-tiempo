import { useEffect, useState, useCallback } from "react";
import {
  Cloud,
  CloudRain,
  CloudSnow,
  Sun,
  CloudSun,
  CloudLightning,
  CloudFog,
  Wind,
  Droplets,
  Thermometer,
  Gauge,
  RefreshCw,
  MapPin,
  Bike,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// =============================================================
// Configuración
// =============================================================
const RIAZA = {
  name: "Riaza, Segovia",
  lat: 41.2786,
  lon: -3.4779,
};

// Open-Meteo no requiere API key. Si en el futuro quieres usar
// OpenWeatherMap o WeatherAPI, añade VITE_OPENWEATHER_API_KEY
// como variable de entorno y amplía fetchWeather().
const OPENWEATHER_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY as
  | string
  | undefined;

// =============================================================
// Tipos
// =============================================================
interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  description: string;
  weatherCode: number;
  windSpeed: number; // km/h
  windDirection: number; // grados
  precipitationProb: number; // %
  humidity: number; // %
  uvIndex: number | null;
}

interface DailyForecast {
  date: string; // ISO
  weatherCode: number;
  tempMin: number;
  tempMax: number;
  precipitationProb: number;
  windSpeed: number;
}

interface WeatherData {
  current: CurrentWeather;
  daily: DailyForecast[];
  updatedAt: Date;
}

type CyclingStatus = "good" | "caution" | "bad";

// =============================================================
// Helpers
// =============================================================
function weatherCodeToText(code: number): string {
  // WMO weather interpretation codes (Open-Meteo)
  const map: Record<number, string> = {
    0: "Despejado",
    1: "Mayormente despejado",
    2: "Parcialmente nublado",
    3: "Nublado",
    45: "Niebla",
    48: "Niebla con escarcha",
    51: "Llovizna ligera",
    53: "Llovizna moderada",
    55: "Llovizna densa",
    61: "Lluvia ligera",
    63: "Lluvia moderada",
    65: "Lluvia fuerte",
    71: "Nieve ligera",
    73: "Nieve moderada",
    75: "Nieve fuerte",
    77: "Granos de nieve",
    80: "Chubascos ligeros",
    81: "Chubascos moderados",
    82: "Chubascos violentos",
    85: "Chubascos de nieve",
    86: "Chubascos de nieve fuertes",
    95: "Tormenta",
    96: "Tormenta con granizo",
    99: "Tormenta fuerte con granizo",
  };
  return map[code] ?? "Condición desconocida";
}

function WeatherIcon({
  code,
  className = "h-10 w-10",
}: {
  code: number;
  className?: string;
}) {
  if (code === 0 || code === 1) return <Sun className={`${className} text-amber-500`} />;
  if (code === 2) return <CloudSun className={`${className} text-amber-400`} />;
  if (code === 3) return <Cloud className={`${className} text-slate-400`} />;
  if (code === 45 || code === 48) return <CloudFog className={`${className} text-slate-400`} />;
  if (code >= 51 && code <= 65) return <CloudRain className={`${className} text-sky-500`} />;
  if (code >= 71 && code <= 77) return <CloudSnow className={`${className} text-sky-300`} />;
  if (code >= 80 && code <= 86) return <CloudRain className={`${className} text-sky-600`} />;
  if (code >= 95) return <CloudLightning className={`${className} text-violet-500`} />;
  return <Cloud className={className} />;
}

function degToCompass(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function dayName(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "");
}

function isAdverseCode(code: number): boolean {
  // Tormenta, nieve, granizo
  return code >= 71 && code <= 86 || code >= 95;
}

function calculateCyclingStatus(c: CurrentWeather): {
  status: CyclingStatus;
  label: string;
  message: string;
} {
  const { windSpeed, precipitationProb, temperature, weatherCode } = c;

  if (
    isAdverseCode(weatherCode) ||
    windSpeed > 35 ||
    precipitationProb >= 70
  ) {
    return {
      status: "bad",
      label: "No recomendado",
      message:
        "Condiciones adversas: evita salir en bici hoy y revisa la previsión más tarde.",
    };
  }

  if (
    precipitationProb >= 30 ||
    windSpeed >= 20 ||
    temperature < 8 ||
    temperature > 30
  ) {
    const reasons: string[] = [];
    if (windSpeed >= 20) reasons.push("viento moderado");
    if (precipitationProb >= 30) reasons.push("posible lluvia");
    if (temperature < 8) reasons.push("temperatura baja");
    if (temperature > 30) reasons.push("calor elevado");
    return {
      status: "caution",
      label: "Precaución",
      message: `Precaución: ${reasons.join(", ")} en las próximas horas.`,
    };
  }

  return {
    status: "good",
    label: "Buen día para salir",
    message:
      "Condiciones favorables para una ruta de carretera por la zona de Riaza.",
  };
}

// =============================================================
// Datos simulados (fallback)
// =============================================================
function getMockData(): WeatherData {
  const today = new Date();
  return {
    current: {
      temperature: 18,
      feelsLike: 17,
      description: weatherCodeToText(2),
      weatherCode: 2,
      windSpeed: 12,
      windDirection: 230,
      precipitationProb: 10,
      humidity: 55,
      uvIndex: 4,
    },
    daily: Array.from({ length: 5 }).map((_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const codes = [1, 2, 3, 61, 2];
      return {
        date: d.toISOString(),
        weatherCode: codes[i],
        tempMin: 8 + i,
        tempMax: 18 + i,
        precipitationProb: [10, 15, 30, 65, 20][i],
        windSpeed: [10, 14, 18, 25, 12][i],
      };
    }),
    updatedAt: new Date(),
  };
}

// =============================================================
// Fetch (Open-Meteo, sin API key)
// =============================================================
async function fetchWeather(): Promise<WeatherData> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${RIAZA.lat}&longitude=${RIAZA.lon}` +
    `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,weather_code,wind_speed_10m,wind_direction_10m,uv_index` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max` +
    `&timezone=Europe%2FMadrid&wind_speed_unit=kmh&forecast_days=6`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudo obtener la previsión meteorológica");
  const json = await res.json();

  const current: CurrentWeather = {
    temperature: Math.round(json.current.temperature_2m),
    feelsLike: Math.round(json.current.apparent_temperature),
    description: weatherCodeToText(json.current.weather_code),
    weatherCode: json.current.weather_code,
    windSpeed: Math.round(json.current.wind_speed_10m),
    windDirection: json.current.wind_direction_10m,
    precipitationProb: json.current.precipitation_probability ?? 0,
    humidity: json.current.relative_humidity_2m,
    uvIndex:
      typeof json.current.uv_index === "number"
        ? Math.round(json.current.uv_index * 10) / 10
        : null,
  };

  // Saltamos el día actual (índice 0) y devolvemos los 5 siguientes
  const daily: DailyForecast[] = json.daily.time
    .slice(1, 6)
    .map((iso: string, i: number) => ({
      date: iso,
      weatherCode: json.daily.weather_code[i + 1],
      tempMin: Math.round(json.daily.temperature_2m_min[i + 1]),
      tempMax: Math.round(json.daily.temperature_2m_max[i + 1]),
      precipitationProb: json.daily.precipitation_probability_max[i + 1] ?? 0,
      windSpeed: Math.round(json.daily.wind_speed_10m_max[i + 1]),
    }));

  return { current, daily, updatedAt: new Date() };
}

// =============================================================
// Componente
// =============================================================
export default function WeatherWidget() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchWeather();
      setData(result);
      setUsingMock(false);
    } catch (e) {
      console.error(e);
      setError("No se pudo cargar la previsión. Mostrando datos de ejemplo.");
      setData(getMockData());
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cycling = data ? calculateCyclingStatus(data.current) : null;

  return (
    <div className="w-full rounded-3xl border border-border bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/40 dark:to-blue-950/40 px-6 py-5 border-b border-border">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Meteorología para rutas en Riaza
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Previsión pensada para planificar salidas en bici
            </p>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>{RIAZA.name}</span>
            </div>
          </div>
          <Button
            onClick={load}
            variant="outline"
            size="sm"
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Actualizar previsión
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
            {error}
          </div>
        )}

        {loading && !data ? (
          <LoadingState />
        ) : data ? (
          <>
            {/* Indicador ciclista */}
            {cycling && <CyclingIndicator {...cycling} />}

            {/* Tiempo actual */}
            <CurrentBlock current={data.current} />

            {/* Previsión 5 días */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
                Próximos 5 días
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {data.daily.map((d) => (
                  <DayCard key={d.date} day={d} />
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground flex-wrap gap-2">
              <span>
                Última actualización:{" "}
                {data.updatedAt.toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span>
                {usingMock
                  ? "Datos de ejemplo"
                  : OPENWEATHER_KEY
                    ? "Fuente: OpenWeatherMap"
                    : "Fuente: Open-Meteo"}
              </span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// =============================================================
// Subcomponentes
// =============================================================
function LoadingState() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-20 bg-muted rounded-xl" />
      <div className="h-32 bg-muted rounded-xl" />
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-32 bg-muted rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function CyclingIndicator({
  status,
  label,
  message,
}: {
  status: CyclingStatus;
  label: string;
  message: string;
}) {
  const styles = {
    good: {
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      border: "border-emerald-200 dark:border-emerald-900",
      icon: "bg-emerald-500",
      text: "text-emerald-900 dark:text-emerald-100",
      sub: "text-emerald-700 dark:text-emerald-300",
    },
    caution: {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      border: "border-amber-200 dark:border-amber-900",
      icon: "bg-amber-500",
      text: "text-amber-900 dark:text-amber-100",
      sub: "text-amber-700 dark:text-amber-300",
    },
    bad: {
      bg: "bg-red-50 dark:bg-red-950/30",
      border: "border-red-200 dark:border-red-900",
      icon: "bg-red-500",
      text: "text-red-900 dark:text-red-100",
      sub: "text-red-700 dark:text-red-300",
    },
  }[status];

  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border ${styles.bg} ${styles.border} px-5 py-4`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${styles.icon} text-white shadow-md`}
      >
        <Bike className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <div className={`font-semibold ${styles.text}`}>{label}</div>
        <div className={`text-sm ${styles.sub}`}>{message}</div>
      </div>
    </div>
  );
}

function CurrentBlock({ current }: { current: CurrentWeather }) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-to-br from-sky-50/50 to-transparent dark:from-sky-950/20 p-5">
      <div className="flex items-center gap-5 flex-wrap">
        <WeatherIcon code={current.weatherCode} className="h-16 w-16" />
        <div className="flex-1 min-w-[160px]">
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold text-foreground">
              {current.temperature}°
            </span>
            <span className="text-sm text-muted-foreground">
              Sensación {current.feelsLike}°
            </span>
          </div>
          <div className="text-sm text-foreground mt-1">{current.description}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-5">
        <Metric
          icon={<Wind className="h-4 w-4" />}
          label="Viento"
          value={`${current.windSpeed} km/h`}
          sub={degToCompass(current.windDirection)}
        />
        <Metric
          icon={<CloudRain className="h-4 w-4" />}
          label="Lluvia"
          value={`${current.precipitationProb}%`}
        />
        <Metric
          icon={<Droplets className="h-4 w-4" />}
          label="Humedad"
          value={`${current.humidity}%`}
        />
        <Metric
          icon={<Thermometer className="h-4 w-4" />}
          label="Sensación"
          value={`${current.feelsLike}°C`}
        />
        {current.uvIndex !== null && (
          <Metric
            icon={<Gauge className="h-4 w-4" />}
            label="Índice UV"
            value={`${current.uvIndex}`}
          />
        )}
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl bg-card border border-border px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="text-sky-600 dark:text-sky-400">{icon}</span>
        {label}
      </div>
      <div className="text-base font-semibold text-foreground mt-0.5">
        {value}
        {sub && (
          <span className="text-xs text-muted-foreground font-normal ml-1">
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

function DayCard({ day }: { day: DailyForecast }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex flex-col items-center text-center hover:shadow-md transition-shadow">
      <div className="text-xs font-semibold uppercase text-muted-foreground">
        {dayName(day.date)}
      </div>
      <WeatherIcon code={day.weatherCode} className="h-9 w-9 my-2" />
      <div className="text-sm font-semibold text-foreground">
        {day.tempMax}° <span className="text-muted-foreground font-normal">/ {day.tempMin}°</span>
      </div>
      <div className="flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 mt-1.5">
        <CloudRain className="h-3 w-3" />
        {day.precipitationProb}%
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
        <Wind className="h-3 w-3" />
        {day.windSpeed} km/h
      </div>
    </div>
  );
}
