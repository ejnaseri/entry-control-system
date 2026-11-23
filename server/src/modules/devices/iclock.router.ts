import { Router, type NextFunction, type Request, type Response } from "express";

export const iclockRouter = Router();

const ICLOCK_ENDPOINTS = ["/push"];
// F22 iClock ADMS test endpoints

const ICLOCK_DEBUG = process.env["ICLOCK_DEBUG"] === "1";
const registryCommands = ["C:DATAUPDATE", "C:REALTIME"];
const lastAttlogAtBySn = new Map<string, string>();
const commandQueueBySn = new Map<string, string[]>();
const allowedMethods = "GET,POST,OPTIONS";

function pickQueryValue(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? "");
  if (value === undefined || value === null) return "";
  return String(value);
}

function getSn(req: Request): string {
  return pickQueryValue(req.query["SN"]) || "-";
}

function getTable(req: Request): string {
  return pickQueryValue(req.query["table"]) || "-";
}

function getContentType(req: Request): string {
  const header = req.headers["content-type"];
  if (!header) return "-";
  return Array.isArray(header) ? header.join(",") : header;
}

function isPrintable(buf: Buffer): boolean {
  if (buf.length === 0) return true;
  for (const byte of buf) {
    if (byte === 9 || byte === 10 || byte === 13) continue;
    if (byte < 32 || byte > 126) return false;
  }
  return true;
}

function getRawBuffer(rawBody: unknown): Buffer {
  if (Buffer.isBuffer(rawBody)) {
    return rawBody;
  }
  if (typeof rawBody === "string") {
    return Buffer.from(rawBody, "utf8");
  }
  if (rawBody === undefined || rawBody === null) {
    return Buffer.alloc(0);
  }
  const text = typeof rawBody === "object" ? JSON.stringify(rawBody) : String(rawBody);
  return Buffer.from(text, "utf8");
}

function formatBodyForLog(buf: Buffer): { label: string; body: string } {
  const printable = isPrintable(buf);
  return {
    label: printable ? "utf8" : "hex",
    body: printable ? buf.toString("utf8") : buf.toString("hex"),
  };
}

function logIclockRequest(req: Request, buf: Buffer) {
  const timestamp = new Date().toISOString();
  const bodyInfo = formatBodyForLog(buf);

  console.log("=== ZKTECO ICLOCK RECEIVED ===");
  console.log("endpoint:", `${req.method} ${req.originalUrl}`);
  console.log("headers:", req.headers);
  console.log("query:", req.query);
  console.log("body length:", buf.length);
  console.log(`body (${bodyInfo.label}):`, bodyInfo.body);
  console.log("from IP:", req.ip);
  console.log("timestamp:", timestamp);
}

function logSummary(req: Request, label: string, buf: Buffer) {
  const sn = getSn(req);
  console.log(`[ICLOCK] ${label} SN=${sn} bytes=${buf.length} from=${req.ip}`);
}

function buildTextResponse(body: string | string[]): string {
  const payload = Array.isArray(body) ? body.join("\r\n") : body;
  return payload.endsWith("\r\n") ? payload : `${payload}\r\n`;
}


function sendText(res: Response, body: string | string[]): string {
  const withNewline = buildTextResponse(body);
  res
    .status(200)
    .set("Content-Type", "text/plain; charset=UTF-8")
    .set("Access-Control-Allow-Origin", "*")
    .set("Access-Control-Allow-Headers", "*")
    .set("Access-Control-Allow-Methods", allowedMethods)
    .send(withNewline);
  return withNewline;
}

function handleIclock(label: string) {
  return (req: Request, res: Response) => {
    const buf = getRawBuffer(req.body);
    if (ICLOCK_DEBUG) {
      logIclockRequest(req, buf);
    } else {
      logSummary(req, label, buf);
    }
    sendText(res, "OK");
  };
}

function enqueueCommands(sn: string, commands: string[]) {
  if (!sn || sn === "-") return;
  const queue = commandQueueBySn.get(sn) ?? [];
  if (queue.length === 0) {
    queue.push(...commands);
    commandQueueBySn.set(sn, queue);
    console.log(`[ICLOCK] queued commands SN=${sn}: ${queue.join(", ")}`);
  }
}

function drainCommands(sn: string): string[] {
  if (!sn || sn === "-") return [];
  const queue = commandQueueBySn.get(sn);
  if (!queue || queue.length === 0) return [];
  commandQueueBySn.delete(sn);
  console.log(`[ICLOCK] dequeued commands SN=${sn}: ${queue.join(", ")}`);
  return queue;
}

iclockRouter.use((req: Request, res: Response, next: NextFunction) => {
  const buf = getRawBuffer(req.body);
  const sn = getSn(req);
  const table = getTable(req);
  const contentType = getContentType(req);
  console.log(
    `[ICLOCK] ${req.method} ${req.originalUrl} SN=${sn} table=${table} type=${contentType} bytes=${buf.length}`
  );
  res.on("finish", () => {
    if (ICLOCK_DEBUG) {
      console.log(`[ICLOCK] ${req.method} ${req.originalUrl} -> ${res.statusCode}`);
    }
  });
  next();
});

iclockRouter.options(/.*/, (_req, res) => {
  sendText(res, "OK");
});

function handleCdata(req: Request, res: Response) {
  const buf = getRawBuffer(req.body);
  if (ICLOCK_DEBUG) logIclockRequest(req, buf);
  else logSummary(req, "cdata", buf);

  const sn = getSn(req);
  const table = pickQueryValue(req.query["table"]).toUpperCase();
  if (table === "ATTLOG") {
    const bodyText = buf.toString("utf8");
    console.log(`[ICLOCK] attlog via cdata SN=${sn} bytes=${buf.length}`);
    console.log("attlog preview:", bodyText.slice(0, 200));
    if (!lastAttlogAtBySn.has(sn)) {
      console.log(`[ICLOCK] attlog received SN=${sn} (cdata)`);
    }
    lastAttlogAtBySn.set(sn, new Date().toISOString());
  }

  // iClock "options" style response
  const lines = [
    "OK",
    `GET OPTION FROM: ${sn}`,
    // minimal set that many firmwares accept
    "Stamp=0",
    "OpStamp=0",
    "PhotoStamp=0",
    "ErrorDelay=30",
    "Delay=10",
    "TransInterval=1",
    "TransTimes=00:00;23:59",
    "Realtime=1",
    "Encrypt=0",
  ];

  const responseText = sendText(res, lines);
  if (ICLOCK_DEBUG) console.log("cdata response raw:", responseText);
}

function handleDevicecmd(req: Request, res: Response) {
  const buf = getRawBuffer(req.body);
  const sn = getSn(req);
  if (ICLOCK_DEBUG) logIclockRequest(req, buf);
  else logSummary(req, "devicecmd", buf);

  const commands = drainCommands(sn);
  const responseText = sendText(res, commands.length > 0 ? commands : "OK");
  console.log(
    `[ICLOCK] devicecmd sent SN=${sn}: ${commands.length > 0 ? commands.join(", ") : "OK"}`
  );
  if (ICLOCK_DEBUG) {
    console.log("devicecmd response raw:", responseText);
  }
}

iclockRouter.get("/devicecmd", handleDevicecmd);
iclockRouter.post("/devicecmd", handleDevicecmd);

iclockRouter.get("/cdata", handleCdata);
iclockRouter.post("/cdata", handleCdata);

iclockRouter.post("/registry", (req, res) => {
  const buf = getRawBuffer(req.body);
  const sn = getSn(req);
  if (ICLOCK_DEBUG) {
    logIclockRequest(req, buf);
  } else {
    logSummary(req, "registry", buf);
  }
  enqueueCommands(sn, registryCommands);
  sendText(res, "OK");
});

function handleGetrequest(req: Request, res: Response) {
  const buf = getRawBuffer(req.body);
  const sn = getSn(req);
  if (ICLOCK_DEBUG) {
    logIclockRequest(req, buf);
  } else {
    logSummary(req, "getrequest", buf);
  }
  const commands = drainCommands(sn);
  const responseText = sendText(res, commands.length > 0 ? commands : "OK");
  console.log(
    `[ICLOCK] getrequest sent SN=${sn}: ${commands.length > 0 ? commands.join(", ") : "OK"}`
  );
  if (ICLOCK_DEBUG) {
    console.log("getrequest response raw:", responseText);
  }
}

iclockRouter.get("/getrequest", handleGetrequest);
iclockRouter.post("/getrequest", handleGetrequest);

iclockRouter.post("/attlog", (req, res) => {
  const buf = getRawBuffer(req.body);
  const sn = pickQueryValue(req.query["SN"]) || "-";
  console.log(`[ICLOCK] attlog SN=${sn} bytes=${buf.length} from=${req.ip}`);
  const bodyText = buf.toString("utf8");
  if (ICLOCK_DEBUG) {
    logIclockRequest(req, buf);
    console.log("attlog preview:", bodyText.slice(0, 200));
  }
  if (!lastAttlogAtBySn.has(sn)) {
    console.log(`[ICLOCK] attlog received SN=${sn}`);
  }
  lastAttlogAtBySn.set(sn, new Date().toISOString());
  sendText(res, "OK");
});

iclockRouter.post("/data", handleIclock("data"));
iclockRouter.post("/rtdata", (req, res) => {
  const buf = getRawBuffer(req.body);
  const sn = pickQueryValue(req.query["SN"]) || "-";
  console.log(`[ICLOCK] rtdata SN=${sn} bytes=${buf.length} from=${req.ip}`);
  if (buf.length === 0) {
    console.log(`[ICLOCK] rtdata empty payload SN=${sn}`);
  }
  if (ICLOCK_DEBUG) {
    logIclockRequest(req, buf);
  }
  sendText(res, "OK");
});

ICLOCK_ENDPOINTS.forEach((path) => {
  iclockRouter.get(path, handleIclock(path.slice(1)));
  iclockRouter.post(path, handleIclock(path.slice(1)));
});

iclockRouter.get("/ping", handleIclock("ping"));

iclockRouter.all(/.*/, (req, res) => {
  if (ICLOCK_DEBUG) {
    console.log(`[ICLOCK] unknown route hit: ${req.method} ${req.originalUrl}`);
  }
  sendText(res, "OK");
});
