import { cpSync, rmSync, writeFileSync } from "node:fs";
rmSync("docs", { recursive: true, force: true });
cpSync("dist", "docs", { recursive: true });
writeFileSync("docs/.nojekyll", "");
console.log("docs/ listo para GitHub Pages.");
