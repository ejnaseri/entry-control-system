export type DeviceEventType = "CHECK_IN" | "CHECK_OUT" | "UNKNOWN";

export interface DeviceEvent {
  deviceId: string;
  externalUserId: string;
  timestamp: Date;
  eventType: DeviceEventType;
  recordId?: number;
  raw?: unknown;
}

export interface DeviceClient {
  /** Identifier used internally (e.g., device id or host). */
  id: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /**
   * Returns only events that are new since the previous poll.
   */
  fetchNewEvents(): Promise<DeviceEvent[]>;
}
