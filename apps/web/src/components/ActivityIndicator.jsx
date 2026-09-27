export default function ActivityIndicator({ events }) {
  return <div className="activity" aria-label="Recent media activity" title={events.map((event) => `${event.type}: ${event.label}`).join('\n')}><span className="activity-dot" /><span>Activity</span><b>{events.length}</b></div>;
}
