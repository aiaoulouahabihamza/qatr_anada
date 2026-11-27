const path = require("path");
const express = require("express");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";
const ROOT = __dirname;

app.use((req, res, next) => {
  if (
    req.path === "/server.js" ||
    req.path === "/package.json" ||
    req.path === "/package-lock.json" ||
    req.path === "/bun.lock"
  ) {
    return res.status(404).end();
  }
  if (req.path === "/sw.js" || req.path === "/manifest.webmanifest") {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  } else if (
    req.path === "/" ||
    !path.extname(req.path) ||
    /\.(html|js|css)$/i.test(req.path)
  ) {
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
  }
  next();
});

express.static.mime.define({
  "application/manifest+json": ["webmanifest"],
  "text/markdown; charset=utf-8": ["RM"]
});

app.use(express.static(ROOT, {
  extensions: ["html"],
  index: "index.html"
}));

app.use((req, res) => {
  res.status(404).sendFile(path.join(ROOT, "index.html"));
});

app.listen(PORT, HOST, () => {
  console.log(`Qatr Al Nada server listening on http://${HOST}:${PORT}`);
});
