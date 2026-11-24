import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SAFE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export function assertImageName(name) {
  if (!SAFE.test(name || "") || name.includes("..")) {
    throw new Error("Niedozwolona nazwa pliku zdjęcia.");
  }
  return name;
}

async function encode(input, width, format) {
  const pipeline = sharp(input).rotate().resize({ width, withoutEnlargement: true });
  if (format === "avif") return pipeline.avif({ quality: 48, effort: 4 }).toBuffer({ resolveWithObject: true });
  return pipeline.webp({ quality: 74 }).toBuffer({ resolveWithObject: true });
}

async function reuse(reuseDir, filename, width) {
  if (!reuseDir) return null;
  try {
    const data = await readFile(path.join(reuseDir, filename));
    const meta = await sharp(data).metadata();
    return meta.width === width ? { data, info: { width: meta.width, height: meta.height } } : null;
  } catch {
    return null;
  }
}

async function makeSet(input, id, hash, widths, format, mediaDir, reuseDir) {
  const meta = await sharp(input).rotate().metadata();
  const sourceWidth = meta.width || widths[widths.length - 1];
  const targets = [];
  for (const width of widths) {
    const target = Math.min(width, sourceWidth);
    if (!targets.includes(target)) targets.push(target);
  }
  const ext = format === "avif" ? "avif" : "webp";
  const out = [];
  for (const width of targets) {
    const { data, info } = (await reuse(reuseDir, `${id}-${hash}-${width}.${ext}`, width)) || (await encode(input, width, format));
    const filename = `${id}-${hash}-${info.width}.${ext}`;
    await writeFile(path.join(mediaDir, filename), data);
    out.push({ src: `media/${filename}`, w: info.width, h: info.height });
  }
  return out;
}

export async function buildImages(draft, uploadsDir, mediaDir, reuseDir) {
  const files = new Set();
  if (draft.hero?.image) files.add(assertImageName(draft.hero.image));
  for (const item of draft.gallery || []) {
    if (item.file) files.add(assertImageName(item.file));
  }

  const manifest = {};
  for (const file of files) {
    let input;
    try {
      input = await readFile(path.join(uploadsDir, file));
    } catch {
      throw new Error(`Brakuje pliku zdjęcia ${file}. Wgraj je ponownie.`);
    }
    const hash = createHash("sha1").update(input).digest("hex").slice(0, 8);
    const id = file.replace(/\.[a-z0-9]+$/i, "").replace(/[^a-zA-Z0-9]+/g, "-");
    try {
      const isHero = file === draft.hero?.image;
      const gridWidths = isHero ? [640, 960, 1280, 1920] : [480, 960];
      const webp = await makeSet(input, id, hash, gridWidths, "webp", mediaDir, reuseDir);
      const avif = await makeSet(input, id, hash, gridWidths, "avif", mediaDir, reuseDir);
      const full = isHero ? webp[webp.length - 1] : (await makeSet(input, `${id}-full`, hash, [1600], "webp", mediaDir, reuseDir))[0];
      manifest[file] = { webp, avif, full };
    } catch (error) {
      throw new Error(`Nie udało się przygotować zdjęcia ${file}. ${error.message}`);
    }
  }
  return manifest;
}
