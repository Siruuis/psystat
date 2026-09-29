const { contextBridge, clipboard } = require("electron");

const portArg = process.argv.find((a) => a.startsWith("--engine-port="));
const port = portArg ? portArg.split("=")[1] : "8000";

contextBridge.exposeInMainWorld("psystat", {
  engineUrl: `http://127.0.0.1:${port}`,
  clipboardWrite: (text) => clipboard.writeText(text),
  clipboardRead: () => clipboard.readText(),
});
