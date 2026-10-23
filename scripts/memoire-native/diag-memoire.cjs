/**
 * Mémoire native, étapes 2 à 5 : petite route de DIAGNOSTIC locale, chargée par `node --require` (jamais en production).
 * Elle écoute sur 127.0.0.1:$DIAG_PORT (défaut 3199), à côté du serveur, sans toucher au code du studio :
 *   GET /           → process.memoryUsage()
 *   GET /gc         → ramasse-miettes forcé (si --expose-gc) puis process.memoryUsage()
 */
// Chargé par `node --require` (CommonJS obligatoire) : pas d'import ESM possible ici.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const http = require("node:http");

// Seul le processus lancé par mesurer.mjs écoute : `NODE_OPTIONS` (donc ce --require) passe aussi aux processus enfants
// éventuels, qui ne trouvent plus DIAG_PORT et ne font rien.
const port = Number(process.env.DIAG_PORT || 0);
delete process.env.DIAG_PORT;
const serveur = http.createServer((req, res) => {
  if (req.url === "/gc" && typeof global.gc === "function") global.gc();
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(process.memoryUsage()));
});
serveur.on("error", (e) => console.error("[diag-memoire]", e.message));
if (port) serveur.listen(port, "127.0.0.1");
serveur.unref();

/*
 * DIAG_INTL=1 : compte les `new Intl.DateTimeFormat` (et `Intl.DateTimeFormat(…)`) par lieu d'appel.
 *   GET /intl → { total, parLieu: { "fichier:ligne": n } } (les 3 premiers cadres du code de l'application).
 */
if (process.env.DIAG_INTL === "1") {
  const Origine = Intl.DateTimeFormat;
  const comptes = new Map();
  let total = 0;
  const noter = () => {
    total++;
    const pile = (new Error().stack || "").split("\n").slice(3, 9).map((l) => l.trim().replace(/^at /, "")).filter((l) => !l.includes("node:internal")).slice(0, 3).join(" < ");
    comptes.set(pile, (comptes.get(pile) || 0) + 1);
  };
  Intl.DateTimeFormat = new Proxy(Origine, {
    construct(cible, args, nouvelle) {
      noter();
      return Reflect.construct(cible, args, nouvelle);
    },
    apply(cible, ceci, args) {
      noter();
      return Reflect.apply(cible, ceci, args);
    },
  });
  const ecouter = serveur.listeners("request")[0];
  serveur.removeAllListeners("request");
  serveur.on("request", (req, res) => {
    if (req.url !== "/intl") return ecouter(req, res);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ total, parLieu: Object.fromEntries([...comptes].sort((a, b) => b[1] - a[1]).slice(0, 25)) }, null, 1));
  });
}
