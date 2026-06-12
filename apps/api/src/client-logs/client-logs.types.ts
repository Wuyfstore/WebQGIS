export type ClientLogEntry = {
  id: string;
  receivedAt: string;
  source: "vue" | "window" | "promise" | "manual";
  message: string;
  stack?: string;
  component?: string;
  info?: string;
  url?: string;
  userAgent?: string;
};
