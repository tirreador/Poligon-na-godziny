import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { publishSite, restorePublicIfNeeded } from "./lib/publish.js";
import { assertImageName } from "./lib/images.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "public");
const uploadsDir = path.join(root, "content", "uploads");
const draftPath = path.join(root, "content", "draft.json");
const publishedPath = path.join(root, "content", "published.json");
const USER = "wlasciciel";
const PASSWORD = process.env.ADMIN_PASSWORD || "poligon-demo";
const sessions = new Map();
const port = Number(process.env.PORT || 4173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8"
};

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function cookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const index = part.indexOf("=");
    if (index > 0) out[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  }
  return out;
}

function sessionUser(req) {
  const token = cookies(req).poligon;
  const session = token && sessions.get(token);
  if (!session || session.expires < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  return session.user;
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Przesłane dane są za duże."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function json(res, status, payload) {
  send(res, status, JSON.stringify(payload), { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

function pageShell(title, body) {
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="/admin/admin.css">
  <link rel="icon" href="/favicon.svg">
</head>
<body>${body}</body>
</html>`;
}

function loginPage(error) {
  return pageShell("Logowanie — Poligon na Godziny", `
    <main class="login">
      <h1>Poligon na Godziny</h1>
      <p class="demo"><strong>Dane demonstracyjne.</strong><br>Login: wlasciciel<br>Hasło: ${PASSWORD === "poligon-demo" ? "poligon-demo" : "ustawione w środowisku"}</p>
      ${error ? `<p class="error">${error}</p>` : ""}
      <form method="post" action="/admin/login">
        <label class="field"><span>Login</span><input name="user" type="text" autocomplete="username" required></label>
        <label class="field"><span>Hasło</span><input name="password" type="password" autocomplete="current-password" required></label>
        <button class="primary" type="submit">Zaloguj</button>
      </form>
    </main>`);
}

function adminPage(draft, published) {
  const embed = (data) => JSON.stringify(data).replace(/</g, "\\u003c");
  return pageShell("Panel — Poligon na Godziny", `
    <header class="top">
      <h1>Panel właściciela</h1>
      <form method="post" action="/admin/logout"><button class="ghost" type="submit">Wyloguj</button></form>
    </header>
    <nav class="sections" aria-label="Sekcje">
      <a href="#sekcja-pierwszy">Pierwszy ekran</a>
      <a href="#sekcja-cennik">Cennik</a>
      <a href="#sekcja-voucher">Voucher</a>
      <a href="#sekcja-galeria">Galeria</a>
      <a href="#sekcja-dojazd">Dojazd</a>
      <a href="#sekcja-aktualnosci">Aktualności</a>
    </nav>
    <div class="panel" id="panel"></div>
    <div class="bar">
      <p id="status" role="status"></p>
      <button class="primary" type="button" id="publish">Zapisz i opublikuj</button>
      <button type="button" id="retry" hidden>Ponów</button>
      <a id="view" href="/" target="_blank" rel="noopener" hidden>Zobacz stronę</a>
    </div>
    <script id="draft-data" type="application/json">${embed(draft)}</script>
    <script id="published-data" type="application/json">${embed(published)}</script>
    <script src="/admin/admin.js" defer></script>`);
}

function validate(draft) {
  if (!draft || typeof draft !== "object") return "Brak treści do publikacji.";
  if (!draft.hero?.title?.trim() || !draft.hero?.lead?.trim()) return "Uzupełnij nagłówek i opis pierwszego ekranu.";
  if (!draft.hero?.image) return "Brakuje zdjęcia otwierającego.";
  if (!draft.contact?.phone?.trim()) return "Uzupełnij numer telefonu.";
  if (!Array.isArray(draft.offers) || !draft.offers.length) return "Cennik jest pusty.";
  for (const item of draft.gallery || []) {
    if (!item.file) return "Jedno ze zdjęć galerii nie ma pliku.";
    if (!String(item.alt || "").trim()) return "Każde zdjęcie w galerii potrzebuje opisu alternatywnego.";
  }
  return "";
}

async function serveFile(res, file, cache) {
  try {
    const data = await readFile(file);
    const ext = path.extname(file);
    send(res, 200, data, {
      "content-type": types[ext] || "application/octet-stream",
      "cache-control": cache
    });
  } catch {
    send(res, 404, "Nie znaleziono", { "content-type": "text/plain; charset=utf-8" });
  }
}

function inside(parent, target) {
  const relative = path.relative(parent, target);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === "/admin/login" && req.method === "POST") {
    const body = new URLSearchParams((await readBody(req, 20_000)).toString());
    if (safeEqual(body.get("user"), USER) && safeEqual(body.get("password"), PASSWORD)) {
      const token = randomBytes(24).toString("hex");
      sessions.set(token, { user: USER, expires: Date.now() + 12 * 60 * 60 * 1000 });
      send(res, 303, "", { location: "/admin", "set-cookie": `poligon=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200` });
      return;
    }
    send(res, 401, loginPage("Login lub hasło nie pasuje."), { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    return;
  }

  if (pathname === "/admin/logout" && req.method === "POST") {
    const token = cookies(req).poligon;
    if (token) sessions.delete(token);
    send(res, 303, "", { location: "/admin", "set-cookie": "poligon=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" });
    return;
  }

  if (pathname === "/admin" && req.method === "GET") {
    if (!sessionUser(req)) {
      send(res, 200, loginPage(), { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      return;
    }
    const draft = await readJson(draftPath);
    const published = await readJson(publishedPath);
    send(res, 200, adminPage(draft, published), { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    return;
  }

  if (pathname === "/admin/admin.css" || pathname === "/admin/admin.js") {
    const file = pathname.endsWith(".css") ? "admin.css" : "admin.js";
    await serveFile(res, path.join(root, "src", file), "no-store");
    return;
  }

  if (pathname.startsWith("/admin/")) {
    if (!sessionUser(req)) {
      json(res, 401, { ok: false, error: "Sesja wygasła. Zaloguj się ponownie." });
      return;
    }

    if (pathname.startsWith("/admin/uploads/") && req.method === "GET") {
      const name = assertImageName(path.basename(pathname));
      await serveFile(res, path.join(uploadsDir, name), "no-store");
      return;
    }

    if (pathname === "/admin/api/upload" && req.method === "POST") {
      try {
        const payload = JSON.parse((await readBody(req, 20 * 1024 * 1024)).toString());
        const buffer = Buffer.from(payload.dataBase64 || "", "base64");
        if (!buffer.length || buffer.length > 15 * 1024 * 1024) {
          json(res, 400, { ok: false, error: "Wybierz zdjęcie mniejsze niż 15 MB." });
          return;
        }
        const meta = await sharp(buffer).metadata();
        const ext = meta.format === "png" ? "png" : meta.format === "webp" ? "webp" : meta.format === "avif" ? "avif" : "jpg";
        if (!["jpeg", "png", "webp", "avif"].includes(meta.format)) {
          json(res, 400, { ok: false, error: "To nie jest obsługiwane zdjęcie. Użyj JPG, PNG, WebP albo AVIF." });
          return;
        }
        const file = `u${Date.now().toString(36)}${randomBytes(3).toString("hex")}.${ext}`;
        await mkdir(uploadsDir, { recursive: true });
        await writeFile(path.join(uploadsDir, file), buffer);
        json(res, 200, { ok: true, file });
      } catch (error) {
        json(res, 400, { ok: false, error: error.message || "Nie udało się wgrać zdjęcia." });
      }
      return;
    }

    if (pathname === "/admin/api/publish" && req.method === "POST") {
      try {
        const draft = JSON.parse((await readBody(req, 2 * 1024 * 1024)).toString());
        const problem = validate(draft);
        if (problem) {
          json(res, 400, { ok: false, error: problem });
          return;
        }
        await writeFile(draftPath, JSON.stringify(draft, null, 2) + "\n");
        const result = await publishSite(draft, root);
        json(res, 200, { ok: true, url: result.url });
      } catch (error) {
        json(res, 500, { ok: false, error: error.message || "Publikacja nie powiodła się." });
      }
      return;
    }

    send(res, 404, "Nie znaleziono", { "content-type": "text/plain; charset=utf-8" });
    return;
  }

  const requested = pathname === "/" ? "/index.html" : pathname;
  const file = path.resolve(publicDir, `.${requested}`);
  if (!inside(publicDir, file)) {
    send(res, 403, "Niedozwolone", { "content-type": "text/plain; charset=utf-8" });
    return;
  }
  const cache = requested === "/index.html" || requested.endsWith(".js") ? "no-cache" : "public, max-age=31536000, immutable";
  await serveFile(res, file, cache);
}

await mkdir(uploadsDir, { recursive: true });
await restorePublicIfNeeded(root);
const draft = await readJson(draftPath);
if (!draft) throw new Error("Brak content/draft.json");
let published = false;
try {
  await access(path.join(publicDir, "index.html"));
  published = true;
} catch {
  published = false;
}
if (!published) await publishSite(draft, root);

createServer((req, res) => {
  handle(req, res).catch((error) => {
    if (!res.headersSent) json(res, 500, { ok: false, error: error.message || "Błąd serwera." });
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`Poligon na Godziny: http://127.0.0.1:${port}`);
  console.log(`Panel: http://127.0.0.1:${port}/admin`);
});
