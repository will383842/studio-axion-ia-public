import "../interrupteurs-inventaire.test";
import type { Domaine } from "../interrupteurs-inventaire.test";

/** Domaine « site-et-visuels » de l'inventaire des interrupteurs (règle `domaineDe` du fichier principal). Lancer CE fichier rejoue l'inventaire ENTIER. */
export const DOMAINE: Domaine = {
  nom: "site-et-visuels",
  litterales: {
    "site.lienDansYoutube": "eteint",
  },
  constantes: [
    { cle: "carrousels.actif", etat: "eteint", appel: "src/visuels/interrupteur.ts", motif: /lireParametre<unknown>\(cleDe\(famille\), false\)\) === true/ },
    { cle: "infographies.actif", etat: "eteint", appel: "src/visuels/interrupteur.ts", motif: /lireParametre<unknown>\(cleDe\(famille\), false\)\) === true/ },
    { cle: "kb_site.lecture.actif", etat: "eteint", appel: "src/services/kb-site.ts", motif: /REGLAGE_LECTURE_SITE, false\)\) === true/ },
    { cle: "kb_site.methode.actif", etat: "eteint", appel: "src/services/kb-site.ts", motif: /REGLAGE_METHODE_SITE, false\)\) === true/ },
    { cle: "site.passeportParClaude", etat: "eteint", appel: "src/services/site-videos.ts", motif: /PARAM_PASSEPORT_PAR_CLAUDE, false\)\) === true/ },
    { cle: "site.reglages", etat: "allume", appel: "src/services/source-axion.ts", motif: /lireParametre<ReglagesSite>\(PARAM_REGLAGES, \{ actif: true \}\)/ },
  ],
  gabarits: [
    {
      gabarit: "siteGenerateurs.*",
      etat: "eteint",
      appel: "src/services/site-videos.ts",
      motif: /lireParametre<boolean>\(cleSiteGenerateur\(formatId\), false\)\) === true/,
      declare: /cleSiteGenerateur = \(formatId: string\) => `siteGenerateurs\.\$\{formatId\}`/,
    },
    {
      gabarit: "siteAuto.*",
      etat: "eteint",
      appel: "src/services/site-videos.ts",
      motif: /lireParametre<boolean>\(cleSiteAuto\(f\.id\), false\)\) === true/,
      declare: /cleSiteAuto = \(formatId: string\) => `siteAuto\.\$\{formatId\}`/,
    },
    {
      // Texte de légende enregistré d'un carrousel (page de détail) : une valeur, pas un interrupteur ; `simulation === true` est un champ de la donnée.
      gabarit: "visuels.legende.*.*",
      etat: "valeur",
      appel: "src/app/(studio)/carrousels/[id]/page.tsx",
      motif: /lireParametre<\{ texte\?: unknown; simulation\?: unknown \} \| null>\(`visuels\.legende\.\$\{id\}\.\$\{r\}`, null\)/,
    },
  ],
  planScenes: {},
  retouche: {},
  exclusCles: {
    "cibles.miroir": "memoire",
    "corbeille-visuels.dernierPassage": "memoire",
    "corbeille.dernierPassage": "memoire",
    "infographies.fiche.*": "memoire",
    "infographies.index": "memoire",
    "partages.codesSupprimes": "memoire",
    "site.depart": "memoire",
    "site.dernierBilan": "memoire",
    "site.derniereLecture": "memoire",
    "suivi.miroir_site": "memoire",
  },
  parExpression: {
    "app/(studio)/carrousels/[id]/actions.ts:cle": { exclu: "memoire" },
    "app/(studio)/carrousels/[id]/actions.ts:cleLegende(id, reseau)": { exclu: "memoire" },
    "app/(studio)/carrousels/[id]/actions.ts:cleLegende(id, r as ReseauLegende)": { exclu: "memoire" },
    "app/(studio)/infographies/actions.ts:cleFiche(id)": { exclu: "memoire" },
    "app/api/usine/visuels/route.ts:`${PREFIXE_COMMANDE}${cle}`": { exclu: "dedoublonnage" },
    "app/api/usine/visuels/route.ts:`${PREFIXE_COTE}${cle}`": { exclu: "dedoublonnage" },
    "services/site-videos.ts:cleSiteGenerateur(formatId)": { couvre: "siteGenerateurs.*" },
    "services/site-videos.ts:cleSiteAuto(f.id)": { couvre: "siteAuto.*" },
    "services/site-videos.ts:cleSiteAuto(video.formatId)": { couvre: "siteAuto.*" },
    "visuels/interrupteur.ts:cleDe(famille)": { couvre: "carrousels.actif" }, // et infographies.actif (CLES_INTERRUPTEURS_VISUELS)
    "visuels/services/carrousels.ts:CLE_SESSION + empreinteSession": { exclu: "memoire" },
    "visuels/services/production.ts:PREFIXE_REGISTRE + empreinte": { exclu: "dedoublonnage" },
  },
  env: [],
  nombre: { litterales: 1, constantes: 6, gabarits: 3, planScenes: 0, retouche: 0, exclusCles: 10, parExpression: 12, env: 0 },
  retirees: [],
};
