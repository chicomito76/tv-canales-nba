import { writeFileSync } from "node:fs";
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santiago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const base = process.argv[2] || today;
const games = [];
const broadcasts = {
  demo: true,
  lastUpdated: new Date().toISOString(),
  games: {},
};
for (const offset of [-1, 0, 1]) {
  const date = new Date(base + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  const day = date.toISOString().slice(0, 10);
  const pairs = [
    ["Cleveland Cavaliers", "Philadelphia 76ers", "CLE", "PHI"],
    ["Denver Nuggets", "Oklahoma City Thunder", "DEN", "OKC"],
    ["Portland Trail Blazers", "Sacramento Kings", "POR", "SAC"],
    ["Boston Celtics", "Los Angeles Lakers", "BOS", "LAL"],
  ];
  for (let i = 0; i < pairs.length; i++) {
    const [away, home, awayCode, homeCode] = pairs[i];
    const utc = new Date(day + "T23:00:00Z");
    utc.setUTCHours(23 + i);
    const id = `DEMO-${day}-${awayCode}-${homeCode}`;
    games.push({ id, utc: utc.toISOString(), away, home, awayCode, homeCode });
    if (i < 3)
      broadcasts.games[id] = {
        status: ["confirmed", "pending", "none"][i],
        channels: i === 0 ? ["ESPN 2", "Disney+", "ESPN 2"] : [],
      };
  }
}
writeFileSync(
  "public/data/schedule.json",
  JSON.stringify({ demo: true, games }, null, 2) + "\n",
);
writeFileSync(
  "public/data/broadcasts.json",
  JSON.stringify(broadcasts, null, 2) + "\n",
);
console.log("Datos ficticios para ayer, hoy y mañana generados.");
