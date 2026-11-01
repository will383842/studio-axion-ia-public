/**
 * NAV · préchargement Node du serveur de développement en SIMULATION (NODE_OPTIONS=--require …).
 *
 * 1. BLOQUE tout réseau sortant : seul le bouclage local (127.0.0.1, localhost, ::1) passe, par fetch comme par http/https.
 * 2. Redirige l'adresse de Zernio vers le FAUX Zernio local (NAV_FAUX_ZERNIO_PORT) : aucun appel réel, aucune vraie clé.
 * 3. Branche le lecteur de l'écran Migration (point d'injection prévu par le Studio) sur un fichier JSON d'essai
 *    (NAV_ETAT_MIGRATION) relu à chaque requête : le test change l'état en réécrivant ce fichier.
 * Données 100 % fictives. Aucun fichier de src/ n'est modifié.
 */
"use strict";
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");

const BOUCLAGE = new Set(["127.0.0.1", "localhost", "::1", "[::1]", "0.0.0.0"]);
const PORT_FAUX = process.env.NAV_FAUX_ZERNIO_PORT;
const estBoucle = (hote) => BOUCLAGE.has(String(hote || "").toLowerCase());
const refus = (cible) => Object.assign(new TypeError(`réseau sortant bloqué par les tests navigateur : ${cible}`), { code: "NAV_RESEAU_BLOQUE" });

const fetchReel = globalThis.fetch;
if (typeof fetchReel === "function" && !globalThis.__navFetchPatche) {
  globalThis.__navFetchPatche = true;
  globalThis.fetch = async function fetchNav(entree, init) {
    const texte = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url;
    let url;
    try {
      url = new URL(texte);
    } catch {
      return fetchReel(entree, init);
    }
    if (url.hostname === "zernio.com" || url.hostname.endsWith(".zernio.com")) {
      if (!PORT_FAUX) throw refus("faux Zernio non démarré");
      return fetchReel(`http://127.0.0.1:${PORT_FAUX}${url.pathname}${url.search}`, typeof entree === "string" || entree instanceof URL ? init : { ...init, method: entree.method, headers: entree.headers, body: entree.body });
    }
    if (!estBoucle(url.hostname)) throw refus(url.hostname);
    return fetchReel(entree, init);
  };
}

for (const module_ of [http, https]) {
  for (const nom of ["request", "get"]) {
    const original = module_[nom];
    module_[nom] = function (...args) {
      const premier = args[0];
      let hote = "";
      if (typeof premier === "string") hote = new URL(premier).hostname;
      else if (premier instanceof URL) hote = premier.hostname;
      else hote = (premier && (premier.hostname || premier.host)) || "localhost";
      if (!estBoucle(String(hote).split(":")[0] || hote)) throw refus(hote);
      return original.apply(this, args);
    };
  }
}

// Lecteur de l'écran Migration (clé globale prévue par src/services/lecteur-migration.ts).
const FICHIER = process.env.NAV_ETAT_MIGRATION;
if (FICHIER) {
  globalThis[Symbol.for("studio.lecteurMigration")] = async () => {
    try {
      const brut = JSON.parse(fs.readFileSync(FICHIER, "utf8"));
      if (brut && brut.lecteur === "panne") throw new Error("lecteur en panne (essai)");
      return brut && brut.posts ? brut : null;
    } catch (e) {
      if (e && e.code === "ENOENT") return null;
      throw e;
    }
  };
}
