import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publishSite } from "../lib/publish.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const draft = JSON.parse(await readFile(path.join(root, "content", "draft.json"), "utf8"));
await publishSite(draft, root);
console.log("Opublikowano stronę do katalogu public.");
