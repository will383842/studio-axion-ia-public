/**
 * BOUCHONS DE `next/*` POUR LE LANCEUR DU TABLEAU, HORS DE NEXT (essai réel du 11/10).
 *
 * `--reel` charge `src/services/credits.ts`, qui importe `./auth`, qui importe `next/navigation` et `next/headers` :
 * sous `tsx --conditions=react-server`, ces modules tirent le React de Next et plantent au chargement
 * (« _react.default.createContext is not a function »). Le lanceur n'a ni requête ni session : il n'appelle rien de
 * `auth` (`verifierEtReserver` ne demande pas de session). Ces bouchons remplacent donc les trois modules :
 *  - `next/headers` et `next/navigation` : toute fonction appelée REFUSE (erreur claire) — jamais un faux succès ;
 *  - `next/cache` : invalider le cache des pages n'a pas de sens hors du serveur → sans effet.
 *
 * Posé par le lanceur lui-même (`installerBouchonsNext`) avant les imports du mode réel ; peut aussi se charger à la
 * main : `npx tsx --conditions=react-server --require ./scripts/tableau/bouchons-next.cjs scripts/tableau/fabriquer.ts …`.
 * N'est JAMAIS chargé par le studio (Next) : seulement par ce lanceur.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS : chargé par `require` (lanceur ou `--require`).
const Module = require("node:module");

const refus = (nom) => () => {
  throw new Error(`${nom} n'existe pas hors de Next : le lanceur du tableau ne doit pas l'appeler.`);
};

const BOUCHONS = {
  "next/headers": { cookies: refus("cookies()"), headers: refus("headers()"), draftMode: refus("draftMode()") },
  "next/navigation": {
    redirect: refus("redirect()"),
    permanentRedirect: refus("permanentRedirect()"),
    notFound: refus("notFound()"),
    forbidden: refus("forbidden()"),
    unauthorized: refus("unauthorized()"),
    useRouter: refus("useRouter()"),
    usePathname: refus("usePathname()"),
    useSearchParams: refus("useSearchParams()"),
    useParams: refus("useParams()"),
    RedirectType: { push: "push", replace: "replace" },
  },
  "next/cache": {
    revalidatePath: () => undefined,
    revalidateTag: () => undefined,
    unstable_noStore: () => undefined,
    unstable_cache: (f) => f,
  },
};

if (!Module.__bouchonsNextTableau) {
  const charger = Module._load;
  Module._load = function (requete, ...reste) {
    const nom = typeof requete === "string" ? requete.replace(/\.js$/, "") : requete;
    if (Object.prototype.hasOwnProperty.call(BOUCHONS, nom)) return BOUCHONS[nom];
    return charger.call(this, requete, ...reste);
  };
  Module.__bouchonsNextTableau = true;
}

module.exports = { MODULES_BOUCHES: Object.keys(BOUCHONS) };
