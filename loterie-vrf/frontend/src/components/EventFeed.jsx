export default function EventFeed({ events }) {
  return (
    <section className="card">
      <div className="cardTitle">Event feed</div>

      {events.length === 0 ? (
        <div className="empty">Încă nu avem evenimente.</div>
      ) : (
        <div className="feed">
          {events.map((e) => (
            <div className="event" key={e.t}>
              <div className="eventTop">
                <b>{e.label}</b>
                <span className="muted">{new Date(e.t).toLocaleTimeString()}</span>
              </div>
              <pre className="pre">{JSON.stringify(e.payload, null, 2)}</pre>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
