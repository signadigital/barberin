import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  analyticsVisitors,
  analyticsSessions,
  analyticsPageViews,
  analyticsEvents,
} from "@/db/schema";
import { requireSuperadmin } from "./auth-session";

// ============================================================================
// TYPES
// ============================================================================

export type AnalyticsOverview = {
  visitors: number;
  sessions: number;
  pageViews: number;
  averageSessionDurationSeconds: number;
};

export type AnalyticsTimeSeriesItem = {
  date: string;
  visitors: number;
  sessions: number;
};

export type AnalyticsTrafficSource = {
  source: string;
  sessions: number;
  percentage: number;
};

export type AnalyticsTopPage = {
  path: string;
  pageViews: number;
  percentage: number;
};

export type AnalyticsDevice = {
  device: string;
  sessions: number;
  percentage: number;
};

export type AnalyticsEventSummary = {
  eventName: string;
  count: number;
};

export type AnalyticsCtaBreakdown = {
  label: string;
  location: string;
  count: number;
};

export type WebsiteAnalyticsResult = {
  overview: AnalyticsOverview;
  timeSeries: AnalyticsTimeSeriesItem[];
  trafficSources: AnalyticsTrafficSource[];
  topPages: AnalyticsTopPage[];
  devices: AnalyticsDevice[];
  events: AnalyticsEventSummary[];
  ctaBreakdown: AnalyticsCtaBreakdown[];
  dateRange: {
    startDate: string;
    endDate: string;
    range: string;
  };
};

export type PublicAnalyticsPayload = {
  anonymousId: string;
  sessionId?: string;
  path: string;
  pageTitle?: string;
  eventName?: string;
  properties?: Record<string, unknown>;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
  referrer?: string;
  landingPage?: string;
  deviceType?: string;
  browser?: string;
  operatingSystem?: string;
};

// ============================================================================
// SERVER FUNCTION: PUBLIC INGESTION (FIRE-AND-FORGET)
// ============================================================================

const SESSION_INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes

export const recordPublicAnalyticsEvent = createServerFn({ method: "POST" })
  .validator((data: PublicAnalyticsPayload) => {
    // Validate and limit payload size
    if (!data || typeof data !== "object") {
      throw new Error("Invalid payload");
    }

    const anonymousId = String(data.anonymousId || "")
      .trim()
      .slice(0, 255);
    if (!anonymousId) {
      throw new Error("Missing anonymousId");
    }

    const path = String(data.path || "/")
      .trim()
      .slice(0, 500);
    const pageTitle = data.pageTitle ? String(data.pageTitle).trim().slice(0, 255) : undefined;
    const eventName = data.eventName ? String(data.eventName).trim().slice(0, 100) : undefined;
    const sessionId = data.sessionId ? String(data.sessionId).trim().slice(0, 100) : undefined;

    let properties: Record<string, unknown> | undefined = undefined;
    if (data.properties && typeof data.properties === "object") {
      try {
        const serialized = JSON.stringify(data.properties);
        if (serialized.length <= 4096) {
          properties = JSON.parse(serialized);
        }
      } catch {
        properties = undefined;
      }
    }

    const utm = data.utm
      ? {
          source: data.utm.source ? String(data.utm.source).trim().slice(0, 255) : undefined,
          medium: data.utm.medium ? String(data.utm.medium).trim().slice(0, 255) : undefined,
          campaign: data.utm.campaign ? String(data.utm.campaign).trim().slice(0, 255) : undefined,
          content: data.utm.content ? String(data.utm.content).trim().slice(0, 255) : undefined,
          term: data.utm.term ? String(data.utm.term).trim().slice(0, 255) : undefined,
        }
      : undefined;

    return {
      anonymousId,
      sessionId,
      path,
      pageTitle,
      eventName,
      properties,
      utm,
      referrer: data.referrer ? String(data.referrer).trim().slice(0, 500) : undefined,
      landingPage: data.landingPage ? String(data.landingPage).trim().slice(0, 500) : undefined,
      deviceType: data.deviceType ? String(data.deviceType).trim().slice(0, 50) : undefined,
      browser: data.browser ? String(data.browser).trim().slice(0, 50) : undefined,
      operatingSystem: data.operatingSystem
        ? String(data.operatingSystem).trim().slice(0, 50)
        : undefined,
    };
  })
  .handler(async ({ data }) => {
    // Exclude internal platform administration routes from public website analytics ingestion
    if (data.path.startsWith("/superadmin") || data.path.startsWith("/owner")) {
      return { success: true, ignored: true };
    }

    try {
      const now = new Date();

      // 1. Upsert Visitor
      let visitorId: string;
      const existingVisitors = await db
        .select({ id: analyticsVisitors.id })
        .from(analyticsVisitors)
        .where(eq(analyticsVisitors.anonymous_id, data.anonymousId))
        .limit(1);

      if (existingVisitors.length > 0) {
        visitorId = existingVisitors[0].id;
        await db
          .update(analyticsVisitors)
          .set({ last_seen_at: now })
          .where(eq(analyticsVisitors.id, visitorId));
      } else {
        const [inserted] = await db
          .insert(analyticsVisitors)
          .values({
            anonymous_id: data.anonymousId,
            first_seen_at: now,
            last_seen_at: now,
          })
          .returning({ id: analyticsVisitors.id });
        visitorId = inserted.id;
      }

      // 2. Active Session Management (30 min inactivity window)
      let activeSessionId: string | null = null;
      if (data.sessionId) {
        const existingSession = await db
          .select({
            id: analyticsSessions.id,
            visitor_id: analyticsSessions.visitor_id,
            last_activity_at: analyticsSessions.last_activity_at,
          })
          .from(analyticsSessions)
          .where(eq(analyticsSessions.id, data.sessionId))
          .limit(1);

        if (existingSession.length > 0) {
          const sess = existingSession[0];
          const timeSinceLastActivity = now.getTime() - new Date(sess.last_activity_at).getTime();
          if (
            sess.visitor_id === visitorId &&
            timeSinceLastActivity < SESSION_INACTIVITY_LIMIT_MS
          ) {
            activeSessionId = sess.id;
            await db
              .update(analyticsSessions)
              .set({ last_activity_at: now })
              .where(eq(analyticsSessions.id, activeSessionId));
          }
        }
      }

      // If no valid active session, start a new session
      if (!activeSessionId) {
        const [newSession] = await db
          .insert(analyticsSessions)
          .values({
            visitor_id: visitorId,
            started_at: now,
            last_activity_at: now,
            landing_page: data.landingPage || data.path,
            referrer: data.referrer || null,
            utm_source: data.utm?.source || null,
            utm_medium: data.utm?.medium || null,
            utm_campaign: data.utm?.campaign || null,
            utm_content: data.utm?.content || null,
            utm_term: data.utm?.term || null,
            device_type: data.deviceType || "desktop",
            browser: data.browser || "other",
            operating_system: data.operatingSystem || "other",
          })
          .returning({ id: analyticsSessions.id });

        activeSessionId = newSession.id;
      }

      // 3. Record Page View (if eventName is "page_view" or not provided)
      if (!data.eventName || data.eventName === "page_view") {
        await db.insert(analyticsPageViews).values({
          session_id: activeSessionId,
          path: data.path,
          page_title: data.pageTitle || null,
          viewed_at: now,
        });
      }

      // 4. Record Marketing Event (if eventName is provided and not "page_view")
      if (data.eventName && data.eventName !== "page_view") {
        await db.insert(analyticsEvents).values({
          session_id: activeSessionId,
          event_name: data.eventName,
          path: data.path,
          properties: data.properties || null,
          created_at: now,
        });
      }

      return {
        success: true,
        sessionId: activeSessionId,
        visitorId,
      };
    } catch (err: unknown) {
      console.warn(
        "[ANALYTICS] Ingestion error swallowed:",
        err instanceof Error ? err.message : err,
      );
      return { success: false, error: "Internal processing error" };
    }
  });

// ============================================================================
// SERVER FUNCTION: SUPERADMIN AGGREGATIONS
// ============================================================================

export type SuperadminAnalyticsFilter = {
  range?: "today" | "yesterday" | "7d" | "30d" | "custom";
  startDate?: string;
  endDate?: string;
};

function calculateWibDateRange(
  range: "today" | "yesterday" | "7d" | "30d" | "custom" = "7d",
  customStart?: string,
  customEnd?: string,
) {
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  const now = new Date();
  const nowWibMs = now.getTime() + WIB_OFFSET_MS;
  const nowWibDate = new Date(nowWibMs);

  const year = nowWibDate.getUTCFullYear();
  const month = nowWibDate.getUTCMonth();
  const date = nowWibDate.getUTCDate();

  if (range === "today") {
    const start = new Date(Date.UTC(year, month, date) - WIB_OFFSET_MS);
    const end = now;
    return { start, end };
  }

  if (range === "yesterday") {
    const start = new Date(Date.UTC(year, month, date - 1) - WIB_OFFSET_MS);
    const end = new Date(Date.UTC(year, month, date - 1, 23, 59, 59, 999) - WIB_OFFSET_MS);
    return { start, end };
  }

  if (range === "30d") {
    const start = new Date(Date.UTC(year, month, date - 29) - WIB_OFFSET_MS);
    const end = now;
    return { start, end };
  }

  if (range === "custom" && customStart && customEnd) {
    const start = new Date(customStart);
    const end = new Date(customEnd);
    return { start, end };
  }

  // Default: 7d (Last 7 Days)
  const start = new Date(Date.UTC(year, month, date - 6) - WIB_OFFSET_MS);
  const end = now;
  return { start, end };
}

export const getSuperadminAnalytics = createServerFn({ method: "GET" })
  .validator((data?: SuperadminAnalyticsFilter) => data)
  .handler(async ({ data }): Promise<WebsiteAnalyticsResult> => {
    // 1. Security Check: Require Superadmin Authorization
    requireSuperadmin();

    const range = data?.range || "7d";
    const { start, end } = calculateWibDateRange(range, data?.startDate, data?.endDate);

    // 2. Query Overview Stats: Sessions & Visitors
    const [sessionStats] = await db
      .select({
        totalSessions: sql<number>`count(*)::int`,
        totalVisitors: sql<number>`count(distinct ${analyticsSessions.visitor_id})::int`,
        avgDurationSeconds: sql<number>`coalesce(avg(case when ${analyticsSessions.last_activity_at} > ${analyticsSessions.started_at} then extract(epoch from (${analyticsSessions.last_activity_at} - ${analyticsSessions.started_at})) else 0 end), 0)::int`,
      })
      .from(analyticsSessions)
      .where(and(gte(analyticsSessions.started_at, start), lte(analyticsSessions.started_at, end)));

    // 3. Query Overview Stats: Page Views
    const [pageViewStats] = await db
      .select({
        totalPageViews: sql<number>`count(*)::int`,
      })
      .from(analyticsPageViews)
      .where(and(gte(analyticsPageViews.viewed_at, start), lte(analyticsPageViews.viewed_at, end)));

    const totalSessions = sessionStats?.totalSessions || 0;
    const totalVisitors = sessionStats?.totalVisitors || 0;
    const totalPageViews = pageViewStats?.totalPageViews || 0;
    const avgDuration = sessionStats?.avgDurationSeconds || 0;

    // 4. Time Series Chart (Daily WIB Aggregation)
    const timeSeriesRaw = await db
      .select({
        date: sql<string>`to_char(${analyticsSessions.started_at} AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`,
        visitors: sql<number>`count(distinct ${analyticsSessions.visitor_id})::int`,
        sessions: sql<number>`count(*)::int`,
      })
      .from(analyticsSessions)
      .where(and(gte(analyticsSessions.started_at, start), lte(analyticsSessions.started_at, end)))
      .groupBy(
        sql`to_char(${analyticsSessions.started_at} AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD')`,
      )
      .orderBy(
        sql`to_char(${analyticsSessions.started_at} AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') ASC`,
      );

    // Fill missing dates in range for smooth time-series chart
    const timeSeriesMap = new Map<string, { visitors: number; sessions: number }>();
    for (const item of timeSeriesRaw) {
      timeSeriesMap.set(item.date, { visitors: item.visitors, sessions: item.sessions });
    }

    const timeSeries: AnalyticsTimeSeriesItem[] = [];
    const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
    const curWib = new Date(start.getTime() + WIB_OFFSET_MS);
    const endWib = new Date(end.getTime() + WIB_OFFSET_MS);

    while (curWib <= endWib || timeSeries.length === 0) {
      const dateKey = curWib.toISOString().slice(0, 10);
      const existing = timeSeriesMap.get(dateKey) || { visitors: 0, sessions: 0 };
      timeSeries.push({
        date: dateKey,
        visitors: existing.visitors,
        sessions: existing.sessions,
      });
      curWib.setUTCDate(curWib.getUTCDate() + 1);
      if (curWib > endWib) break;
    }

    // 5. Traffic Sources Breakdown
    const trafficSourcesRaw = await db
      .select({
        source: sql<string>`
          coalesce(
            nullif(${analyticsSessions.utm_source}, ''),
            case
              when ${analyticsSessions.referrer} is null or ${analyticsSessions.referrer} = '' then 'Direct'
              when ${analyticsSessions.referrer} ilike '%instagram%' then 'Instagram'
              when ${analyticsSessions.referrer} ilike '%google%' then 'Google'
              when ${analyticsSessions.referrer} ilike '%tiktok%' then 'TikTok'
              when ${analyticsSessions.referrer} ilike '%facebook%' then 'Facebook'
              when ${analyticsSessions.referrer} ilike '%twitter%' or ${analyticsSessions.referrer} ilike '%x.com%' then 'Twitter / X'
              else substring(${analyticsSessions.referrer} from '^(?:https?://)?(?:www\\.)?([^/]+)')
            end,
            'Direct'
          )
        `,
        sessions: sql<number>`count(*)::int`,
      })
      .from(analyticsSessions)
      .where(and(gte(analyticsSessions.started_at, start), lte(analyticsSessions.started_at, end)))
      .groupBy(sql`1`)
      .orderBy(desc(sql`count(*)::int`))
      .limit(10);

    const trafficSources: AnalyticsTrafficSource[] = trafficSourcesRaw.map((row) => ({
      source: row.source || "Direct",
      sessions: row.sessions,
      percentage: totalSessions > 0 ? Math.round((row.sessions / totalSessions) * 100) : 0,
    }));

    // 6. Top Pages Breakdown
    const topPagesRaw = await db
      .select({
        path: analyticsPageViews.path,
        pageViews: sql<number>`count(*)::int`,
      })
      .from(analyticsPageViews)
      .where(and(gte(analyticsPageViews.viewed_at, start), lte(analyticsPageViews.viewed_at, end)))
      .groupBy(analyticsPageViews.path)
      .orderBy(desc(sql`count(*)::int`))
      .limit(10);

    const topPages: AnalyticsTopPage[] = topPagesRaw.map((row) => ({
      path: row.path,
      pageViews: row.pageViews,
      percentage: totalPageViews > 0 ? Math.round((row.pageViews / totalPageViews) * 100) : 0,
    }));

    // 7. Device Breakdown
    const devicesRaw = await db
      .select({
        device: sql<string>`coalesce(${analyticsSessions.device_type}, 'Desktop')`,
        sessions: sql<number>`count(*)::int`,
      })
      .from(analyticsSessions)
      .where(and(gte(analyticsSessions.started_at, start), lte(analyticsSessions.started_at, end)))
      .groupBy(sql`coalesce(${analyticsSessions.device_type}, 'Desktop')`)
      .orderBy(desc(sql`count(*)::int`));

    const devices: AnalyticsDevice[] = devicesRaw.map((row) => {
      const rawDevice = row.device.toLowerCase();
      const formatted =
        rawDevice === "mobile"
          ? "Mobile"
          : rawDevice === "tablet"
            ? "Tablet"
            : rawDevice === "desktop"
              ? "Desktop"
              : "Lainnya";
      return {
        device: formatted,
        sessions: row.sessions,
        percentage: totalSessions > 0 ? Math.round((row.sessions / totalSessions) * 100) : 0,
      };
    });

    // 8. Events Summary
    const eventsRaw = await db
      .select({
        eventName: analyticsEvents.event_name,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .where(and(gte(analyticsEvents.created_at, start), lte(analyticsEvents.created_at, end)))
      .groupBy(analyticsEvents.event_name)
      .orderBy(desc(sql`count(*)::int`));

    const events: AnalyticsEventSummary[] = eventsRaw.map((row) => ({
      eventName: row.eventName,
      count: row.count,
    }));

    // 9. CTA Breakdown (by label and location)
    const ctaRaw = await db
      .select({
        label: sql<string>`coalesce(${analyticsEvents.properties}->>'label', 'CTA')`,
        location: sql<string>`coalesce(${analyticsEvents.properties}->>'location', 'hero')`,
        count: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .where(
        and(
          gte(analyticsEvents.created_at, start),
          lte(analyticsEvents.created_at, end),
          eq(analyticsEvents.event_name, "cta_click"),
        ),
      )
      .groupBy(
        sql`coalesce(${analyticsEvents.properties}->>'label', 'CTA')`,
        sql`coalesce(${analyticsEvents.properties}->>'location', 'hero')`,
      )
      .orderBy(desc(sql`count(*)::int`))
      .limit(10);

    const ctaBreakdown: AnalyticsCtaBreakdown[] = ctaRaw.map((row) => ({
      label: row.label,
      location: row.location,
      count: row.count,
    }));

    return {
      overview: {
        visitors: totalVisitors,
        sessions: totalSessions,
        pageViews: totalPageViews,
        averageSessionDurationSeconds: avgDuration,
      },
      timeSeries,
      trafficSources,
      topPages,
      devices,
      events,
      ctaBreakdown,
      dateRange: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        range,
      },
    };
  });

// ============================================================================
// CLIENT-SIDE TRACKER UTILITIES (LIGHTWEIGHT, ROBUST & NON-BLOCKING)
// ============================================================================

const VISITOR_COOKIE_NAME = "barberin_visitor_id";
const SESSION_COOKIE_NAME = "barberin_session_id";
const SESSION_ACTIVITY_KEY = "barberin_session_activity";

function getCookieClient(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"));
  return match ? decodeURIComponent(match[3]) : null;
}

function setCookieClient(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

export function getOrCreateAnonymousVisitorId(): string {
  if (typeof window === "undefined") return "";

  // 1. Check Cookie
  let id = getCookieClient(VISITOR_COOKIE_NAME);
  if (id && id.length >= 8) {
    return id;
  }

  // 2. Check localStorage fallback
  try {
    const localId = localStorage.getItem(VISITOR_COOKIE_NAME);
    if (localId && localId.length >= 8) {
      setCookieClient(VISITOR_COOKIE_NAME, localId, 365 * 24 * 60 * 60);
      return localId;
    }
  } catch {
    /* ignore storage error */
  }

  // 3. Generate Random UUID
  id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);

  setCookieClient(VISITOR_COOKIE_NAME, id, 365 * 24 * 60 * 60);
  try {
    localStorage.setItem(VISITOR_COOKIE_NAME, id);
  } catch {
    /* ignore storage error */
  }

  return id;
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";

  const now = Date.now();
  let sessionId = getCookieClient(SESSION_COOKIE_NAME);
  let lastActivity = 0;

  try {
    const storedActivity = sessionStorage.getItem(SESSION_ACTIVITY_KEY);
    if (storedActivity) lastActivity = parseInt(storedActivity, 10);
  } catch {
    /* ignore storage error */
  }

  // Check 30-min timeout
  if (sessionId && lastActivity && now - lastActivity < 30 * 60 * 1000) {
    try {
      sessionStorage.setItem(SESSION_ACTIVITY_KEY, now.toString());
    } catch {
      /* ignore storage error */
    }
    setCookieClient(SESSION_COOKIE_NAME, sessionId, 1800);
    return sessionId;
  }

  // Create new session
  sessionId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : "s_" + Math.random().toString(36).slice(2) + Date.now().toString(36);

  setCookieClient(SESSION_COOKIE_NAME, sessionId, 1800);
  try {
    sessionStorage.setItem(SESSION_ACTIVITY_KEY, now.toString());
    sessionStorage.setItem(SESSION_COOKIE_NAME, sessionId);
  } catch {
    /* ignore storage error */
  }

  return sessionId;
}

function parseClientEnvironment(): {
  deviceType: "mobile" | "tablet" | "desktop" | "unknown";
  browser: "Chrome" | "Safari" | "Firefox" | "Edge" | "other";
  operatingSystem: "Windows" | "macOS" | "Android" | "iOS" | "Linux" | "other";
} {
  if (typeof navigator === "undefined") {
    return { deviceType: "unknown", browser: "other", operatingSystem: "other" };
  }

  const ua = navigator.userAgent || "";

  // Device
  let deviceType: "mobile" | "tablet" | "desktop" | "unknown" = "desktop";
  if (/ipad|tablet|playbook|silk|(android(?!.*mobi))/i.test(ua)) {
    deviceType = "tablet";
  } else if (/mobi|iphone|ipod|android/i.test(ua)) {
    deviceType = "mobile";
  }

  // Browser
  let browser: "Chrome" | "Safari" | "Firefox" | "Edge" | "other" = "other";
  if (/edg/i.test(ua)) {
    browser = "Edge";
  } else if (/chrome|crios/i.test(ua)) {
    browser = "Chrome";
  } else if (/firefox|fxios/i.test(ua)) {
    browser = "Firefox";
  } else if (/safari/i.test(ua)) {
    browser = "Safari";
  }

  // Operating System
  let operatingSystem: "Windows" | "macOS" | "Android" | "iOS" | "Linux" | "other" = "other";
  if (/windows/i.test(ua)) {
    operatingSystem = "Windows";
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    operatingSystem = "iOS";
  } else if (/android/i.test(ua)) {
    operatingSystem = "Android";
  } else if (/macintosh|mac os x/i.test(ua)) {
    operatingSystem = "macOS";
  } else if (/linux/i.test(ua)) {
    operatingSystem = "Linux";
  }

  return { deviceType, browser, operatingSystem };
}

function getUtmParams(): {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
} {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get("utm_source") || undefined,
    medium: params.get("utm_medium") || undefined,
    campaign: params.get("utm_campaign") || undefined,
    content: params.get("utm_content") || undefined,
    term: params.get("utm_term") || undefined,
  };
}

// ============================================================================
// PUBLIC TRACKING APIS (CLIENT-SIDE)
// ============================================================================

let lastTrackedPath = "";
let lastTrackedTimestamp = 0;

export function trackPageView(options?: { path?: string; pageTitle?: string }) {
  if (typeof window === "undefined") return;

  const currentPath = options?.path || window.location.pathname || "/";
  // Exclude internal platform administration routes from public analytics tracking
  if (currentPath.startsWith("/superadmin") || currentPath.startsWith("/owner")) {
    return;
  }

  const now = Date.now();

  // Guard against duplicate fires within 1 second for the exact same path
  if (currentPath === lastTrackedPath && now - lastTrackedTimestamp < 1000) {
    return;
  }

  lastTrackedPath = currentPath;
  lastTrackedTimestamp = now;

  try {
    const anonymousId = getOrCreateAnonymousVisitorId();
    const sessionId = getOrCreateSessionId();
    const env = parseClientEnvironment();
    const utm = getUtmParams();
    const referrer = document.referrer || undefined;

    // Fire-and-forget
    recordPublicAnalyticsEvent({
      data: {
        anonymousId,
        sessionId,
        path: currentPath,
        pageTitle:
          options?.pageTitle || (typeof document !== "undefined" ? document.title : undefined),
        eventName: "page_view",
        utm,
        referrer,
        landingPage: currentPath,
        deviceType: env.deviceType,
        browser: env.browser,
        operatingSystem: env.operatingSystem,
      },
    }).catch((err) => {
      // Non-blocking catch
      console.warn("[ANALYTICS] Page view tracking error (safely ignored):", err);
    });
  } catch (err) {
    console.warn("[ANALYTICS] Client page view error (safely ignored):", err);
  }
}

export function trackEvent(
  eventName:
    "cta_click" | "pricing_view" | "register_click" | "login_click" | "contact_click" | string,
  properties?: Record<string, unknown>,
) {
  if (typeof window === "undefined") return;

  try {
    const currentPath = window.location.pathname || "/";
    const anonymousId = getOrCreateAnonymousVisitorId();
    const sessionId = getOrCreateSessionId();
    const env = parseClientEnvironment();

    // Fire-and-forget
    recordPublicAnalyticsEvent({
      data: {
        anonymousId,
        sessionId,
        path: currentPath,
        eventName,
        properties: properties || {},
        deviceType: env.deviceType,
        browser: env.browser,
        operatingSystem: env.operatingSystem,
      },
    }).catch((err) => {
      // Non-blocking catch
      console.warn(`[ANALYTICS] Event "${eventName}" tracking error (safely ignored):`, err);
    });
  } catch (err) {
    console.warn(`[ANALYTICS] Client event "${eventName}" error (safely ignored):`, err);
  }
}
