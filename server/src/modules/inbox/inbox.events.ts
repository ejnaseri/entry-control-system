import { EventEmitter } from "events";
import type { InboxItem } from "@prisma/client";

const inboxEvents = new EventEmitter();
const INBOX_EVENT_NEW = "inbox:new";

export function emitInboxItem(item: InboxItem) {
  inboxEvents.emit(INBOX_EVENT_NEW, item);
}

export function onInboxItem(handler: (item: InboxItem) => void) {
  inboxEvents.on(INBOX_EVENT_NEW, handler);
  return () => inboxEvents.off(INBOX_EVENT_NEW, handler);
}
