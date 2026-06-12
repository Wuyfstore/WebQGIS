import type { App, ComponentPublicInstance } from "vue";

type ClientLogSource = "vue" | "window" | "promise" | "manual";

type ClientLogPayload = {
  source: ClientLogSource;
  message: string;
  stack?: string;
  component?: string;
  info?: string;
  url?: string;
  userAgent?: string;
};

function normalizeError(error: unknown): Pick<ClientLogPayload, "message" | "stack"> {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack
    };
  }
  if (typeof error === "string") {
    return { message: error };
  }
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

function componentName(instance: ComponentPublicInstance | null): string | undefined {
  const type = instance?.$?.type;
  return typeof type === "object" && "name" in type && typeof type.name === "string"
    ? type.name
    : undefined;
}

export function reportClientLog(payload: ClientLogPayload): void {
  const body = JSON.stringify({
    ...payload,
    url: payload.url ?? window.location.href,
    userAgent: payload.userAgent ?? window.navigator.userAgent
  });

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon("/api/client-logs", blob)) {
      return;
    }
  }

  void fetch("/api/client-logs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true
  }).catch(() => {
    // Logging must never create a second user-facing failure.
  });
}

export function installClientErrorLogging(app: App): void {
  app.config.errorHandler = (error, instance, info) => {
    const normalized = normalizeError(error);
    reportClientLog({
      source: "vue",
      message: normalized.message,
      stack: normalized.stack,
      component: componentName(instance),
      info
    });
    console.error(error);
  };

  window.addEventListener("error", (event) => {
    const normalized = normalizeError(event.error ?? event.message);
    reportClientLog({
      source: "window",
      message: normalized.message,
      stack: normalized.stack,
      info: `${event.filename}:${event.lineno}:${event.colno}`
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const normalized = normalizeError(event.reason);
    reportClientLog({
      source: "promise",
      message: normalized.message,
      stack: normalized.stack
    });
  });
}
