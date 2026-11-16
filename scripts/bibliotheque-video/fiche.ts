/**
 * Fiche lisible de la bibliothèque vidéo (C1-U12) : capacités, format × capacité, réglages, profondeur des mémoires.
 * Fonction pure : aucune lecture de base, aucun réglage lu, rien qui change d'un appel à l'autre.
 * Imports permis : modules purs de `src/briques/bibliotheque-video/` seulement (jamais `src/services`).
 * Lancement : `npx tsx scripts/bibliotheque-video/fiche.ts` réécrit `docs/bibliotheque-video.md`.
 */
import { writeFileSync } from "node:fs";
import { CATALOGUE_CAPACITES, ID } from "../../src/briques/bibliotheque-video/catalogue";
import { FORMATS_PROFIL_NEUTRE, PROFILS_DU_CODE } from "../../src/briques/bibliotheque-video/profils";
import { PROFONDEUR_MEMOIRE } from "../../src/briques/bibliotheque-video/profondeurs";
import { cleReglageBibliotheque } from "../../src/briques/bibliotheque-video/reglage";
import type { IdCapacite, SourceMemoire } from "../../src/briques/bibliotheque-video/types";

const PREFIXE_COULISSE_V4 = "motion.v4-coulisse.";

/** Interrupteurs de PLAN-FINAL § 7, recopiés tels quels (nom, chantier, ce qui allume). */
const INTERRUPTEURS: readonly (readonly [string, string, string])[] = [
  ["bibliothequeVideo.<format>", "1", "`true` ou `{ capacites: […] }`"],
  ["STYLES_TEXTE_ECRAN_INSTALLES (constante)", "2", "une PR d'une ligne, après planche"],
  ["PASTILLE_EN_MANROPE (constante)", "2", "une PR d'une ligne, après planche"],
  ["ETIQUETTE_OUTIL_AUTONOME (constante)", "2", "une PR d'une ligne, après planche"],
  ["avocat.bandeauNom", "2", "`true`"],
  ["VARIANTE_PAR_VIDEO, VARIANTE_PAR_VERSION (constantes existantes)", "—", "ne changent pas : le chemin neuf passe par la capacité `texte.style-varie`"],
  ["bibliothequeVideo.archive.inscription", "3", "`true`"],
  ["bibliothequeVideo.archive.sources", "3", "`\"publiees\"` par défaut"],
  ["facecamAnimee.extraitsMaison", "4", "`true`"],
  ["facecamAnimee.telephoneVideo", "4", "`true`"],
  ["planScenes.facecam", "5", "`true` (défaut du code éteint après 5.02)"],
  ["planScenes.facecamDessin", "5", "`true`"],
  ["habillage.transitionsPlanScenes", "6", "`true`"],
  ["habillage.transitionsStyleMontage", "6", "`true`"],
  ["habillage.lutsSupplementaires", "6", "`true`"],
  ["habillage.sonsEtendus", "6", "`true`, après Q8"],
  ["habillage.sonsTransitions", "6", "`true`, après Q8"],
];

/** Les huit mémoires, dans l'ordre d'affichage. `entre` : la capacité du catalogue qu'elle alimente dans `recents`, sinon hors catalogue. */
const SOURCES: readonly { source: SourceMemoire; entre: string | null }[] = [
  { source: "avocat-cartes", entre: ID.motionCartesCommunes },
  { source: "bibliotheque-video", entre: "choix figés de la bibliothèque (toutes capacités)" },
  { source: "cas-concret-tirages", entre: null },
  { source: "illustrations", entre: null },
  { source: "image-video-variete", entre: null },
  { source: "tableau-styles", entre: null },
  { source: "v4-extraits", entre: ID.ecranClipV4 },
  { source: "v4-familles", entre: ID.motionPlaquettesV4 },
] satisfies readonly { source: SourceMemoire; entre: string | null }[];

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const cellule = (t: string) => t.replace(/\|/g, "\\|").replace(/\n/g, " ");
const code = (t: string) => `\`${t}\``;
const liste = (ids: readonly string[]) => (ids.length ? ids.map(code).join(", ") : "aucune");

function sectionCapacites(): string[] {
  const hors = CATALOGUE_CAPACITES.filter((l) => !l.id.startsWith(PREFIXE_COULISSE_V4));
  const coulisse = CATALOGUE_CAPACITES.filter((l) => l.id.startsWith(PREFIXE_COULISSE_V4));
  const sortie = [
    "## 1. Les capacités",
    "",
    `Le catalogue compte ${CATALOGUE_CAPACITES.length} capacités. L'état dit où elle en est : prod (déjà utilisée), demande (sur demande), eteint, coulisse (préparée, pas visible), absent, prevu.`,
    "",
    "| Capacité | État | Chantier | Décision | Note |",
    "|---|---|---|---|---|",
  ];
  for (const l of hors) sortie.push(`| ${code(l.id)} | ${l.etat} | ${l.chantier ?? "—"} | ${cellule(l.decision ?? "")} | ${cellule(l.note ?? "")} |`);
  if (coulisse.length) {
    sortie.push("", `Résumé : ${coulisse.length} capacités ${code(PREFIXE_COULISSE_V4 + "*")} en coulisse (préparées pour la v4, rien n'est visible) :`, "");
    for (const l of coulisse) sortie.push(`- ${code(l.id)} (${l.etat})`);
  }
  return sortie;
}

function sectionFormats(): string[] {
  const sortie = [
    "## 2. Format × capacité",
    "",
    "Chaque format a un profil : ce qu'il a le droit d'utiliser. « Permis » = autorisé, « refusé » = interdit, avec le plafond par vidéo quand il y en a un.",
    "",
  ];
  for (const formatId of Object.keys(PROFILS_DU_CODE).sort(cmp)) {
    const p = PROFILS_DU_CODE[formatId];
    const regles = Object.entries(p.capacites).sort(([a], [b]) => cmp(a, b)) as [IdCapacite, { permis: boolean; maxParVideo?: number; decision?: string }][];
    const permis = regles.filter(([, r]) => r.permis).map(([id]) => id);
    const refuse = regles.filter(([, r]) => !r.permis).map(([id, r]) => `${code(id)}${r.maxParVideo !== undefined ? ` (au plus ${r.maxParVideo} par vidéo)` : ""}`);
    sortie.push(`### ${code(formatId)}`, "");
    sortie.push(`- Profil : ${code(p.id)}, version ${p.version}.`);
    sortie.push(`- Permis : ${liste(permis)}.`);
    sortie.push(`- Refusé : ${refuse.length ? refuse.join(", ") : "aucune"}.`);
    sortie.push(`- Verrous : ${liste([...p.verrous].sort(cmp))}.`);
    sortie.push(`- Mémoire : les ${p.memoire.fenetreVideos} dernières vidéos, portée « ${p.memoire.portee} ».`, "");
  }
  sortie.push("### Formats au profil neutre", "", "Profil neutre : rien de neuf. Le format garde sa vidéo d'aujourd'hui.", "");
  for (const formatId of [...FORMATS_PROFIL_NEUTRE].sort(cmp)) sortie.push(`- ${code(formatId)} — profil neutre : rien de neuf`);
  return sortie;
}

function sectionReglages(): string[] {
  const formats = [...Object.keys(PROFILS_DU_CODE), ...FORMATS_PROFIL_NEUTRE].sort(cmp);
  const sortie = [
    "## 3. Les réglages",
    "",
    "Tous les réglages sont éteints dans le code : seule la valeur `true` allume. Cette fiche ne lit pas les vraies valeurs en production.",
    "",
    "### Réglage de la bibliothèque, un par format",
    "",
    "- Absent, `false`, toute autre valeur, ou lecture en échec : éteint, rien n'est ajouté à la commande.",
    "- `true` : bibliothèque active pour ce format, aucune capacité neuve (le profil du code tel quel).",
    "- `{ capacites: [\"texte.surlignage-marqueur\", …] }` : active, et ces capacités deviennent permises si le profil les connaît, si leur état n'est ni `coulisse` ni `absent`, et si aucun verrou du profil ne s'y oppose.",
    "",
    "| Format | Réglage |",
    "|---|---|",
  ];
  for (const f of formats) sortie.push(`| ${code(f)} | ${code(cleReglageBibliotheque(f))} |`);
  sortie.push("", "### Tous les interrupteurs (tous éteints dans le code)", "", "| Réglage ou constante | Chantier | Ce qui allume |", "|---|---|---|");
  for (const [nom, chantier, allume] of INTERRUPTEURS) sortie.push(`| ${cellule(nom)} | ${chantier} | ${cellule(allume)} |`);
  return sortie;
}

function sectionMemoires(): string[] {
  const sortie = [
    "## 4. Les mémoires",
    "",
    "Chaque mémoire dit combien de vidéos récentes elle regarde pour éviter les répétitions, et où c'est lu dans le code.",
    "Une mémoire « dans le catalogue » alimente la liste des usages récents ; « hors catalogue » est lue à part (C1-U6a, C1-U6b).",
    "",
    "| Source | Vidéos regardées | Où c'est lu | Dans le catalogue ? |",
    "|---|---|---|---|",
  ];
  for (const { source, entre } of SOURCES) {
    const p = PROFONDEUR_MEMOIRE[source];
    const profondeur = p ? String(p.videos) : "inconnue";
    const dans = entre === null ? "hors catalogue" : `oui : ${entre}`;
    sortie.push(`| ${code(source)} | ${profondeur} | ${cellule(p?.ou ?? "")} | ${cellule(dans)} |`);
  }
  return sortie;
}

export function ficheBibliotheque(): string {
  return [
    "<!-- Généré par scripts/bibliotheque-video/fiche.ts ; ne pas modifier à la main. Relancer : npx tsx scripts/bibliotheque-video/fiche.ts -->",
    "",
    "# Bibliothèque vidéo : la fiche",
    "",
    "Document généré à partir du code. Il montre ce que la bibliothèque sait faire, ce que chaque format a le droit d'utiliser, les réglages et la profondeur des mémoires.",
    "",
    ...sectionCapacites(), "",
    ...sectionFormats(), "",
    ...sectionReglages(), "",
    ...sectionMemoires(), "",
  ].join("\n");
}

if (process.argv[1]?.endsWith("fiche.ts")) writeFileSync("docs/bibliotheque-video.md", ficheBibliotheque());
