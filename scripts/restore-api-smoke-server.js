const { createApp } = require("../server/dist/app");

const port = Number(process.env.PORT || 4101);
const host = process.env.HOST || "127.0.0.1";

const server = createApp().listen(port, host, () => {
  console.log(`RESTORE_API_READY ${host}:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
