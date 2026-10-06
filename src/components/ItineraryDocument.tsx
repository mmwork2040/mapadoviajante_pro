import type { Itinerary, ItineraryActivity, ItineraryDay } from "@/lib/types";
import { formatMoney } from "@/lib/ui";
import "./itinerary-document.css";

const activityNames: Record<string, string> = {
  flight: "Voo",
  hotel: "Hospedagem",
  transfer: "Transporte",
  restaurant: "Gastronomia",
  activity: "Experiência",
  note: "Dica do viajante",
};

function formatTripDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString("pt-BR");
}

function mapHref(activity: ItineraryActivity) {
  if (activity.maps_url && /^https:\/\//i.test(activity.maps_url)) return activity.maps_url;
  if (activity.location?.trim()) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location.trim())}`;
  }
  return null;
}

function activityPeriod(time?: string | null) {
  if (!time || !/^\d{1,2}:\d{2}/.test(time)) return null;
  const hour = Number(time.split(":")[0]);
  return hour < 12 ? "Manhã" : hour < 18 ? "Tarde" : "Noite";
}

function Activity({ activity }: { activity: ItineraryActivity }) {
  const href = mapHref(activity);
  const period = activityPeriod(activity.time);
  return (
    <li className={`osv-trip-activity ${activity.type === "note" ? "osv-trip-activity--tip" : ""}`}>
      <div className="osv-trip-activity-meta">
        <span>{activityNames[activity.type || ""] || "Programação"}</span>
        {period && <span>{period}</span>}
        {activity.time && <time>{activity.time}</time>}
      </div>
      <h4>{activity.title}</h4>
      {activity.description && <p>{activity.description}</p>}
      {activity.location && <p className="osv-trip-location">{activity.location}</p>}
      {typeof activity.cost === "number" && activity.cost > 0 && (
        <p className="osv-trip-cost">
          Valor informado: {formatMoney(activity.cost, activity.currency)}
        </p>
      )}
      {href && (
        <a href={href} target="_blank" rel="noopener noreferrer">
          Ver {activity.location || activity.title} no mapa ↗
        </a>
      )}
    </li>
  );
}

function Day({ day, index, count }: { day: ItineraryDay; index: number; count: number }) {
  const sortedActivities = [...(day.activities || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const number = day.day_number || index + 1;
  return (
    <section className="osv-trip-page osv-trip-day" id={`dia-${index + 1}`}>
      <div className="osv-trip-page-top">
        <img src="/osv-logo-branco.png" alt="O Segredo do Viajante" />
        <a href="#sumario">← Sumário</a>
      </div>
      <div className="osv-trip-day-heading">
        <span className="osv-trip-label">
          DIA {number}
          {day.date ? ` · ${formatTripDate(day.date)}` : ""}
        </span>
        <h2>{day.title || `Dia ${number}`}</h2>
      </div>
      {sortedActivities.length ? (
        <ol className="osv-trip-activities">
          {sortedActivities.map((activity) => (
            <Activity key={activity.id} activity={activity} />
          ))}
        </ol>
      ) : (
        <p className="osv-trip-pending">Programação deste dia a confirmar.</p>
      )}
      <nav className="osv-trip-day-nav" aria-label={`Navegação do dia ${number}`}>
        {index > 0 ? <a href={`#dia-${index}`}>‹ Dia anterior</a> : <span />}
        {index < count - 1 ? <a href={`#dia-${index + 2}`}>Próximo dia ›</a> : <span />}
      </nav>
      <footer>O SEGREDO DO VIAJANTE · {day.title || `DIA ${number}`}</footer>
    </section>
  );
}

export function ItineraryDocument({ it, coverUrl }: { it: Itinerary; coverUrl?: string | null }) {
  const days = [...(it.days || [])].sort(
    (a, b) => (a.sort_order ?? a.day_number ?? 0) - (b.sort_order ?? b.day_number ?? 0),
  );
  const cover = coverUrl && /^https?:\/\//i.test(coverUrl) ? coverUrl : null;
  const destination = it.destination || it.title;
  const flights = days.flatMap((day) => day.activities || []).filter((a) => a.type === "flight");
  const hotels = days.flatMap((day) => day.activities || []).filter((a) => a.type === "hotel");

  return (
    <article className="osv-trip-document">
      <section className="osv-trip-page osv-trip-cover" id="capa">
        {cover && (
          <img
            className="osv-trip-cover-photo"
            src={cover}
            alt={destination ? `Vista de ${destination}` : "Imagem do destino"}
            crossOrigin="anonymous"
          />
        )}
        <div className="osv-trip-cover-veil" />
        <div className="osv-trip-cover-content">
          <img className="osv-trip-logo" src="/osv-logo-branco.png" alt="O Segredo do Viajante" />
          <span className="osv-trip-eyebrow">ROTEIRO DE VIAGEM</span>
          <h1>{destination || "Sua viagem"}</h1>
          {it.client_name && <p>Preparado para {it.client_name}</p>}
          {(it.start_date || it.end_date) && (
            <p className="osv-trip-cover-dates">
              {it.start_date ? formatTripDate(it.start_date) : "Data de ida a confirmar"}
              {it.end_date ? ` — ${formatTripDate(it.end_date)}` : ""}
            </p>
          )}
          <a href="#sumario">Abrir o roteiro ↓</a>
        </div>
      </section>

      <section className="osv-trip-page osv-trip-summary" id="sumario">
        <div className="osv-trip-page-top">
          <img src="/osv-logo-branco.png" alt="O Segredo do Viajante" />
        </div>
        <span className="osv-trip-script">Sua viagem</span>
        <h2>O que você encontra aqui</h2>
        <p>
          O roteiro reúne os dias e as informações já registradas para a viagem. Itens ainda sem
          detalhes aparecem como pendentes.
        </p>
        <div className="osv-trip-facts">
          {it.destination && (
            <div>
              <span>Destino</span>
              <strong>{it.destination}</strong>
            </div>
          )}
          {it.passengers != null && (
            <div>
              <span>Viajantes</span>
              <strong>{it.passengers}</strong>
            </div>
          )}
          <div>
            <span>Programação</span>
            <strong>
              {days.length} {days.length === 1 ? "dia" : "dias"}
            </strong>
          </div>
        </div>
        <nav className="osv-trip-index" aria-label="Sumário do roteiro">
          {flights.length > 0 && (
            <a href="#voos">
              Voos <span>↗</span>
            </a>
          )}
          {hotels.length > 0 && (
            <a href="#hospedagem">
              Hospedagem <span>↗</span>
            </a>
          )}
          {days.map((day, index) => (
            <a key={day.id} href={`#dia-${index + 1}`}>
              <span>Dia {day.day_number || index + 1}</span>
              <strong>{day.title || "Programação a confirmar"}</strong>
              <span>↗</span>
            </a>
          ))}
        </nav>
        <footer>O SEGREDO DO VIAJANTE · {destination?.toUpperCase()}</footer>
      </section>

      {flights.length > 0 && (
        <section className="osv-trip-page osv-trip-overview" id="voos">
          <div className="osv-trip-page-top">
            <img src="/osv-logo-branco.png" alt="O Segredo do Viajante" />
            <a href="#sumario">← Sumário</a>
          </div>
          <span className="osv-trip-script">Como chegar</span>
          <h2>Voos da viagem</h2>
          <ol className="osv-trip-activities">
            {flights.map((flight) => (
              <Activity key={flight.id} activity={flight} />
            ))}
          </ol>
          <footer>O SEGREDO DO VIAJANTE · {destination?.toUpperCase()}</footer>
        </section>
      )}
      {hotels.length > 0 && (
        <section className="osv-trip-page osv-trip-overview" id="hospedagem">
          <div className="osv-trip-page-top">
            <img src="/osv-logo-branco.png" alt="O Segredo do Viajante" />
            <a href="#sumario">← Sumário</a>
          </div>
          <span className="osv-trip-script">Sua base</span>
          <h2>Hospedagem</h2>
          <ol className="osv-trip-activities">
            {hotels.map((hotel) => (
              <Activity key={hotel.id} activity={hotel} />
            ))}
          </ol>
          <footer>O SEGREDO DO VIAJANTE · {destination?.toUpperCase()}</footer>
        </section>
      )}

      {days.map((day, index) => (
        <Day key={day.id} day={day} index={index} count={days.length} />
      ))}

      <section className="osv-trip-page osv-trip-back-cover">
        <img src="/osv-logo-branco.png" alt="O Segredo do Viajante" />
        <h2>
          Boa <em>viagem!</em>
        </h2>
        <p>Guarde este roteiro para consultar os detalhes de cada dia.</p>
        <a href="#sumario">Voltar ao sumário ↑</a>
      </section>
    </article>
  );
}
