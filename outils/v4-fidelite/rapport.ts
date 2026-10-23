/**
 * Écrit `docs/formats/v4-reference/RAPPORT-ECARTS.md` à partir des mesures du banc (`banc.mts`) : un score par scène
 * (avant et après quand les deux mesures existent : `avant` → `apres` pour la mission B de V4-1, `apres` → `v4-2` pour la
 * mission D de V4-2), la comparaison par composants et la liste des écarts.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type Composant = { sorte: string; texte: string; x: number; y: number; l: number; h: number; taille: number; couleur: string; police: string; opacite?: number };
type Mesure = { plan: string; t: number; ecran: string; type: string; ssim: number; ssimBrut: number; iou: number; v4: Composant[]; format: Composant[] };
type ParPlan = { plan: string; debut: number; fin: number; ecrans: string; ssim: number; ssimBrut: number; iou: number };
type Zones = Record<"texte" | "utile" | "sousTitres" | "dessin", { x: number; y: number; largeur: number; hauteur: number }>;
export type DonneesRapport = { etat: "avant" | "apres" | "v4-2" | "v4-3"; parPlan: ParPlan[]; mesures: Mesure[]; zones: Zones; moyenne: number; moyenneIou: number };

const NOMS: Record<string, string> = {
  s1: "Accroche « On recrute… en… »",
  s2: "Chiffre « 15 minutes. »",
  s4: "Liste « Avant »",
  s6: "Bascule « tout automatisé »",
  s7: "Étape 01 · L'annonce",
  s8: "Étape 02 · L'inscription",
  s9: "Étape 03 · Les e-mails",
  s10: "Étape 04 · Le rendez-vous",
  s11: "Objet · Elle oublie ? (rappel)",
  s12: "Étape 05 · La visio (chrono)",
  s13: "Titre « Notre seul travail »",
  s14: "Étape 06 · Le contrat",
  s16: "Objet · Dossier classé",
  s17: "Résultat · barres",
  s18: "Question « Et dans votre entreprise ? »",
  s19: "Appel « Écrivez PLAN »",
  s20: "Promesse « le plan »",
};

const f2 = (x: number) => x.toFixed(2).replace(".", ",");
const f3 = (x: number) => x.toFixed(3).replace(".", ",");
const pct = (y: number) => `${Math.round((y / 1920) * 100)} %`;

/** Le premier composant d'une sorte (affiche : le plus grand). */
function premier(cs: Composant[], sorte: string): Composant | undefined {
  const l = cs.filter((c) => c.sorte === sorte);
  return sorte === "affiche" ? [...l].sort((a, b) => b.taille - a.taille)[0] : l[0];
}
/** Boîte englobante des objets (téléphone, fiche, anneau…). */
function objets(cs: Composant[], sortes: string[]): { y: number; bas: number } | null {
  const l = cs.filter((c) => sortes.includes(c.sorte));
  if (!l.length) return null;
  return { y: Math.min(...l.map((c) => c.y)), bas: Math.max(...l.map((c) => c.y + c.h)) };
}

function tableauComposants(mesures: Mesure[]): string {
  const lignes = mesures
    .filter((_, i) => i % 2 === 1)
    .map((m) => {
      const a4 = premier(m.v4, "affiche");
      const af = premier(m.format, "affiche");
      const e4 = premier(m.v4, "etiquette");
      const ef = premier(m.format, "etiquette");
      const o4 = objets(m.v4, ["telephone", "objet", "anneau"]);
      const of = objets(m.format, ["objet"]);
      const aff = (c?: Composant) => (c ? `${c.y} px · ${Math.round(c.taille)} px` : "—");
      const obj = (o: { y: number; bas: number } | null) => (o ? `${o.y}–${o.bas} (${Math.round(((o.bas - o.y) / 1920) * 100)} %)` : "—");
      return `| ${m.plan} | ${aff(a4)} | ${aff(af)} | ${e4 ? `${e4.y}` : "—"} | ${ef ? `${ef.y}` : "—"} | ${obj(o4)} | ${obj(of)} |`;
    });
  return ["| Plan | Affiche v4 (haut · taille) | Affiche format | Étiquette v4 (haut) | Étiquette format | Objets v4 (haut–bas, part de la hauteur) | Objets format |", "|---|---|---|---|---|---|---|", ...lignes].join("\n");
}

export function ecrireRapport(fichier: string, d: DonneesRapport): void {
  const dossierSortie = join(dirname(fichier), "../../../outils/v4-fidelite/sortie");
  const autre = d.etat === "v4-3" ? join(dossierSortie, "v4-2/mesures.json") : d.etat === "v4-2" ? join(dossierSortie, "apres/mesures.json") : d.etat === "apres" ? join(dossierSortie, "avant/mesures.json") : null;
  const avant = autre && existsSync(autre) ? (JSON.parse(readFileSync(autre, "utf8")) as DonneesRapport) : null;
  const ligne = (p: ParPlan) => {
    const a = avant?.parPlan.find((x) => x.plan === p.plan);
    const avantTxt = a ? ` ${f3(a.ssim)} | ${f2(a.iou)} |` : "";
    return `| ${p.plan} | ${NOMS[p.plan] ?? ""} | ${f2(p.debut)}–${f2(p.fin)} s | ${p.ecrans} |${avantTxt} ${f3(p.ssim)} | ${f3(p.ssimBrut)} | ${f2(p.iou)} |`;
  };
  const entete = avant
    ? "| Plan | Scène | Heures v4 | Écran(s) du format | SSIM avant | Formes avant | SSIM après | SSIM brute après | Formes après |\n|---|---|---|---|---|---|---|---|---|"
    : "| Plan | Scène | Heures v4 | Écran(s) du format | SSIM | SSIM brute | Formes |\n|---|---|---|---|---|---|---|";
  const z = d.zones;
  const texte = `# Rapport des écarts · v4 ↔ format « Cas concret »

Écrit par \`outils/v4-fidelite/banc.mts\` (état « ${d.etat === "v4-3" ? "V4-3, script validé de la v4" : d.etat === "v4-2" ? "V4-2, zone pleine image" : d.etat === "apres" ? "après la mission B" : "avant la mission B"} »${avant ? ` ; « avant » = ${d.etat === "v4-3" ? "fin de V4-2 (master au départ de V4-3)" : d.etat === "v4-2" ? "fin de V4-1, zone sûre des 4 réseaux" : "avant la mission B"}` : ""}). Ne pas retoucher à la main : relancer le banc.

## Méthode

- **v4** : images de \`v4.mp4\` (ffmpeg), deux par plan (à 40 % et 85 % de sa durée), 34 images.
- **Format** : les mêmes instants rendus par la composition \`CasConcretEcran\` (Remotion, rendu local), nourrie par la
  chaîne du format (\`calerFiche\` → \`imagesDuCas\` → \`ecransCales\` → \`proprietesPleineImage\` : zone pleine image, objets
  au-dessus des sous-titres, fil à 92 %)
  à partir du script validé de la v4 (\`scripts-valides/recrutement-apporteurs.ts\`, repris par \`outils/v4-fidelite/fiche-v4.ts\`) calé sur les MÊMES mots (\`voix4.json\`,
  tempo 1,08). Les écrans du format tombent sur les plans de la v4 à 40 ms près.
- **SSIM** : ffmpeg, niveaux de gris, pleine taille, bande des sous-titres de la v4 (1 580–1 780 px) noircie dans les deux
  images (le format pose ses sous-titres au montage, pas sur l'écran). **SSIM brute** : sans ce masque.
- **Formes** : recouvrement (IoU) des masques de contenu (pixels qui se détachent du fond lissé), en 270 × 480, même masque.
  1 = mêmes formes aux mêmes places.

**Attention : la SSIM n'est pas un bon juge ici.** Les grands fonds unis (nuit ou ivoire) pèsent l'essentiel de l'image :
la SSIM masquée dépassait déjà 0,90 quand le contenu était tassé dans la moitié haute. Le **recouvrement des formes** est
la mesure suivie (cible de V4-3 : moyenne ≥ 0,80, aucun plan sous 0,70).

## Score par scène

${entete}
${d.parPlan.map(ligne).join("\n")}

**Moyennes** : SSIM ${f3(d.moyenne)}${avant ? ` (avant : ${f3(avant.moyenne)})` : ""} · formes ${f2(d.moyenneIou)}${avant ? ` (avant : ${f2(avant.moyenneIou)})` : ""}.

## Composants (instant posé de chaque plan)

v4 : lu dans le DOM de \`v4.html\` rendu au même instant. Format : lu dans la mise en page de la brique (\`disposer\`).

${tableauComposants(d.mesures)}

Zones du format (${d.etat === "v4-2" || d.etat === "v4-3" ? "pleine image" : "4 réseaux"}) : texte ${Math.round(z.texte.y)}–${Math.round(z.texte.y + z.texte.hauteur)} px, utile jusqu'à ${Math.round(z.utile.y + z.utile.hauteur)} px,
sous-titres ${Math.round(z.sousTitres.y)}–${Math.round(z.sousTitres.y + z.sousTitres.hauteur)} px (${pct(z.sousTitres.y)} à ${pct(z.sousTitres.y + z.sousTitres.hauteur)}), largeur ${Math.round(z.texte.x)}–${Math.round(z.texte.x + z.texte.largeur)} px.
v4 : étiquette à 250 px, titre à 300 px, objets jusqu'à ~1 576 px (82 %), sous-titres à 1 600 px (83 %), fil à 1 764 px (92 %), largeur 40–1 040 px.

## Ce qui a changé (V4-3 : un script validé, rejoué mot pour mot)

1. **Le script de la v4 est le script validé du cas** (texte de \`voix4.json\` mot pour mot, ordre de \`v4.html\`) : la
   fabrication ne réécrit plus le texte ; le banc mesure exactement ce que la fabrication rejoue.
2. **Liste « avant » sur un seul écran** (plan s4) : les six tâches, rangs de 112 px comme la v4 (V4-2 : deux écrans de
   quatre tâches au plus).
3. **L'annonce recadrée et zoomée** (plan s7, \`tel7\`) : image de 505 px dans l'écran de 442 px, zoom 1,02 → 1,12,
   montée de −10 à −70 px (le mouvement n'est pas jugé par le banc : deux images fixes par plan).

Rappel de V4-2 : échelle 1,0 (zone pleine image), centre horizontal exact, objets au-dessus des sous-titres, fil à 92 %,
chaque objet à sa taille et à sa place de la v4.

## Écarts qui restent

1. **Promesse** (s20) : « LE PLAN. » à 330 px et la signature « Axion-IA » dans la v4 ; le format écrit le cadeau
   à la taille d'affiche (230 px) et pas de signature. La fin du format n'est d'ailleurs pas celle de la v4 (fin par réseau,
   tirée de la banque) : ce plan ne mesure que l'écran de fin écrit à la main pour le banc.
2. **Le rendez-vous** (s10) : la v4 fait défiler la page puis glisse un second écran (\`rdv-2.jpg\`) ; le format ne
   montre qu'un vrai écran par étape (non fait).
3. **Le contrat** (s14) : la v4 change sa ligne au mot « signe » (« Il part tout seul. » → « Elle signe sur son
   téléphone. ») ; le format garde la première.
4. **Accroche** (s1) : la v4 empile trois tailles (230, 150, 230 px) plus bas (630 px) ; le format centre trois lignes.
5. **Marque « axion-ia.com »** en haut de chaque écran du format, absente de la v4 (non changée : à confirmer par Will).
6. **Étiquette d'étape** à ≈ 220 px (v4 250).
7. **Total de la liste** : la v4 écrit « pour chaque personne » sous « +1 H » ; le script n'a que « +1 H » (le schéma de
   la fiche ne porte pas cette ligne).

## Ce qui n'est pas mesuré

- Le mouvement (les images sont fixes, deux par plan) : le banc ne juge ni les entrées, ni le biais, ni le rythme visible ;
  le rythme est seulement comparé par les heures des plans (40 ms près).
- Les sous-titres et le son.
- Les objets du format sans équivalent dans la v4 (autres cas) : même grammaire supposée, non comparée.
`;
  writeFileSync(fichier, texte);
}
