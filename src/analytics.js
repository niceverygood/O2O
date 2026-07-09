import posthog from 'posthog-js';
import { useEffect, useMemo, useRef } from 'react';

const VISITOR_KEY = 'o2o_mvp_visitor_id';
const PROFILE_KEY = 'o2o_mvp_profile';
const EVENTS_KEY = 'o2o_mvp_events';
const SESSION_KEY = 'o2o_mvp_session_id';

let posthogReady = false;

export function getVisitorId() {
  const stored = localStorage.getItem(VISITOR_KEY);
  if (stored) return stored;

  const next = crypto?.randomUUID?.() ?? `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(VISITOR_KEY, next);
  return next;
}

export function getSessionId() {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) return stored;

  const next = crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  sessionStorage.setItem(SESSION_KEY, next);
  return next;
}

export function getProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
  } catch {
    return null;
  }
}

export function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function clearProfile() {
  localStorage.removeItem(PROFILE_KEY);
}

export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || 'https://app.posthog.com';

  if (!key || posthogReady) return Boolean(key);

  posthog.init(key, {
    api_host: host,
    autocapture: true,
    capture_pageview: false,
    disable_session_recording: false,
    persistence: 'localStorage',
    person_profiles: 'identified_only',
  });
  posthog.identify(getVisitorId());
  posthogReady = true;
  return true;
}

export function getEvents() {
  try {
    return JSON.parse(localStorage.getItem(EVENTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function persistEvents(events) {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(-1000)));
  window.dispatchEvent(new CustomEvent('o2o-events-updated'));
}

export function clearEvents() {
  localStorage.removeItem(EVENTS_KEY);
  window.dispatchEvent(new CustomEvent('o2o-events-updated'));
}

export function track(name, properties = {}) {
  const payload = {
    id: crypto?.randomUUID?.() ?? `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    timestamp: new Date().toISOString(),
    properties,
  };

  persistEvents([...getEvents(), payload]);

  if (posthogReady) {
    posthog.capture(name, {
      ...properties,
      visitor_id: payload.visitorId,
      session_id: payload.sessionId,
    });
  }

  return payload;
}

export function useScreenAnalytics(screenName, properties = {}) {
  const stableProperties = useMemo(() => properties, [JSON.stringify(properties)]);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    startedAt.current = Date.now();
    track('screen_view', { screen: screenName, ...stableProperties });

    return () => {
      track('screen_dwell', {
        screen: screenName,
        dwell_ms: Date.now() - startedAt.current,
        ...stableProperties,
      });
    };
  }, [screenName, stableProperties]);
}

export function exportEventsCsv() {
  const events = getEvents();
  const rows = [
    ['timestamp', 'visitorId', 'sessionId', 'event', 'screen', 'properties'],
    ...events.map((event) => [
      event.timestamp,
      event.visitorId,
      event.sessionId,
      event.name,
      event.properties?.screen || '',
      JSON.stringify(event.properties || {}),
    ]),
  ];

  const csv = rows
    .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `o2o-mvp-events-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  track('csv_exported', { count: events.length });
}
