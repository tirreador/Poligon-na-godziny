import { access, copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildImages } from "./images.js";
import { renderPage } from "./render.js";

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function swapDirectories(staging, live, backup) {
  await rm(backup, { recursive: true, force: true });
  const hadLive = await exists(live);
  if (hadLive) await rename(live, backup);
  try {
    await rename(staging, live);
  } catch (error) {
    if (hadLive) await rename(backup, live);
    throw error;
  }
  await rm(backup, { recursive: true, force: true });
}

export async function publishSite(draft, root) {
  const staging = path.join(root, "public-next");
  const live = path.join(root, "public");
  const backup = path.join(root, "public-prev");
  await rm(staging, { recursive: true, force: true });
  await mkdir(path.join(staging, "media"), { recursive: true });
  await mkdir(path.join(staging, "fonts"), { recursive: true });

  const manifest = await buildImages(draft, path.join(root, "content", "uploads"), path.join(staging, "media"));
  const css = await readFile(path.join(root, "src", "site.css"), "utf8");
  await writeFile(path.join(staging, "index.html"), renderPage(draft, manifest, css));
  await copyFile(path.join(root, "src", "gallery.js"), path.join(staging, "gallery.js"));
  await copyFile(path.join(root, "src", "favicon.svg"), path.join(staging, "favicon.svg"));

  const fonts = await readdir(path.join(root, "src", "fonts"));
  for (const font of fonts) {
    if (font.endsWith(".woff2")) {
      await copyFile(path.join(root, "src", "fonts", font), path.join(staging, "fonts", font));
    }
  }

  await swapDirectories(staging, live, backup);
  await writeFile(path.join(root, "content", "published.json"), JSON.stringify(draft, null, 2) + "\n");
  return { url: `/?opublikowano=${Date.now()}` };
}

export async function restorePublicIfNeeded(root) {
  const live = path.join(root, "public");
  const backup = path.join(root, "public-prev");
  if (!(await exists(path.join(live, "index.html"))) && (await exists(path.join(backup, "index.html")))) {
    await rename(backup, live);
  }
}
