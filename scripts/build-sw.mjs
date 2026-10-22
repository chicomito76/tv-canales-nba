import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((f) =>
    f.isDirectory() ? walk(`${dir}/${f.name}`) : [`${dir}/${f.name}`],
  );
const files = walk("dist").filter(
  (f) => !f.includes("/data/") && !f.endsWith("service-worker.js"),
);
const version = createHash("sha256")
  .update(files.map((f) => readFileSync(f)).join(""))
  .digest("hex")
  .slice(0, 12);
const source = readFileSync("public/service-worker.js", "utf8")
  .replace("__VERSION__", version)
  .replace(
    "__PRECACHE__",
    JSON.stringify(["./", ...files.map((f) => "./" + f.slice(5))]),
  );
writeFileSync("dist/service-worker.js", source);
