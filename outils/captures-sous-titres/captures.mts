/**
 * CAPTURES DE CONTRÔLE DES SOUS-TITRES (lot M2) — produites par Remotion `still` sur ce poste, avec le VRAI moteur
 * (`src/briques/sous-titres`) et le VRAI calque (`studio-rendu/compositions/sous-titres`). Aucun appel réseau.
 *
 *   1. les 4 styles retenus par Will (Karaoké, Minimal, Impact, Bandeau) sur la photo de démonstration ;
 *   2. les 3 captures de B.5 avec un montant (« 2 500 € ») : fond noir, illustration claire, simulation de deutéranopie ;
 *   3. le mélange dans une même vidéo (Équilibré) : accroche Impact, base karaoké, soulignement, bandeau, retour à la base.
 *
 * Usage (racine du dépôt) : `pnpm exec tsx outils/captures-sous-titres/captures.mts`
 * puis `python outils/captures-sous-titres/planches.py` (planches côte à côte, comme les maquettes).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SegmentSousTitres } from "@/domaine/types";
import type { DonneesCalque } from "@/briques/sous-titres";
import * as moduleBrique from "@/briques/sous-titres";

// Le module de la brique est lu en CommonJS par tsx : ses exports sont sur `default`.
const brique = ((moduleBrique as unknown as { default?: typeof moduleBrique }).default ?? moduleBrique) as typeof moduleBrique;
const { appliquerChoixGroupe, donneesCalque, elementDe, fabriquerSousTitres, largeurElement } = brique;
const derivations = await import("@/domaine/derivations");
const { horodaterTexte } = ((derivations as unknown as { default?: typeof derivations }).default ?? derivations) as typeof derivations;

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
const SORTIE = join(RACINE, "docs", "captures", "sous-titres-styles");
mkdirSync(SORTIE, { recursive: true });

// Remotion est installé dans le paquet `studio-rendu` (le conteneur de rendu) : on l'utilise tel quel.
const exiger = createRequire(join(RACINE, "studio-rendu", "package.json"));
// Types réduits à ce que le script utilise (les paquets Remotion ne sont pas installés à la racine).
type Composition = { width: number; height: number };
const { bundle } = exiger("@remotion/bundler") as { bundle: (o: { entryPoint: string }) => Promise<string> };
const { renderStill, selectComposition } = exiger("@remotion/renderer") as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown> }) => Promise<Composition>;
  renderStill: (o: { composition: Composition; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; chromiumOptions?: { gl?: string } }) => Promise<unknown>;
};

const dataUrl = (fichier: string) => `data:image/jpeg;base64,${readFileSync(join(ICI, fichier)).toString("base64")}`;
const FOND_DEMO = dataUrl("fond-demo.jpg");
const FOND_CLAIR = dataUrl("fond-clair.jpg");
const RESEAUX = ["tiktok", "instagram", "facebook", "youtube-shorts"] as const;
const MARQUE = { couleurs: [
  { nom: "Noir chaud", jeton: "--fond", valeur: "#16120F" },
  { nom: "Orange vif", jeton: "--orange-vif", valeur: "#E07040" },
  { nom: "Crème", jeton: "--texte", valeur: "#F3EDE4" },
] };

interface Capture {
  nom: string;
  donnees: DonneesCalque;
  instantSec: number;
  fond: { couleur?: string; image?: string };
  deuteranopie?: boolean;
}

const calque = (segments: SegmentSousTitres[], base: "karaoke" | "minimal") => donneesCalque({ segments, base, marque: MARQUE, reseaux: [...RESEAUX] });
/** Instant où le groupe est bien installé (rebond fini, soulignement dessiné, karaoké en cours). */
const instantDe = (s: SegmentSousTitres, part = 0.6) => Math.min(s.finSec - 0.02, s.debutSec + Math.max(0.3, (s.finSec - s.debutSec) * part));

const captures: Capture[] = [];

/* --- 1. Les 4 styles, sur la même phrase --- */
{
  const texte = "Il a gagné 35 heures.";
  const segs = fabriquerSousTitres({ texte, dureeSec: 1.6, intensite: "sobre", emphase: ["gagné"], motsParLigne: 5 }).map((s) => ({ ...s, mots: s.mots }));
  // Une seule ligne de 5 mots pour comparer les styles (comme la maquette).
  const ligne: SegmentSousTitres = { ...segs[0], id: "phrase", finSec: segs.at(-1)!.finSec, mots: segs.flatMap((s) => s.mots) };
  captures.push({ nom: "01-karaoke", donnees: calque([ligne], "karaoke"), instantSec: ligne.mots[2].debutSec + 0.05, fond: { image: FOND_DEMO } });
  captures.push({ nom: "02-minimal", donnees: calque([ligne], "minimal"), instantSec: 1.2, fond: { image: FOND_DEMO } });
  const fort: SegmentSousTitres = { ...ligne, id: "fort", mots: ligne.mots.slice(3).map((m) => ({ ...m, enValeur: false })) };
  const impact = appliquerChoixGroupe([fort], "fort", "impact")[0];
  captures.push({ nom: "03-impact", donnees: calque([impact], "karaoke"), instantSec: impact.debutSec + 0.4, fond: { image: FOND_DEMO } });
  const bandeauSeg: SegmentSousTitres = { ...ligne, id: "bandeau", mots: [{ ...ligne.mots[3] }, { ...ligne.mots[4], mot: "heures" }, { mot: "gagnées", debutSec: 1.5, finSec: 1.6 }].map((m, i) => ({ ...m, enValeur: i === 0 })) };
  const bandeau = { ...appliquerChoixGroupe([bandeauSeg], "bandeau", "bandeau")[0], position: "milieu" as const };
  captures.push({ nom: "04-bandeau", donnees: calque([bandeau], "karaoke"), instantSec: 1.4, fond: { image: FOND_DEMO } });
}

/* --- 2. Contrôles B.5 avec un montant : fond noir, illustration claire, deutéranopie --- */
{
  const texte = "Le juge accorde 2 500 € au salarié.";
  const segs = fabriquerSousTitres({ texte, dureeSec: 1.8, intensite: "sobre", emphase: ["2 500 €"] });
  const avecMontant = segs.find((s) => s.mots.some((m) => m.mot === "500"))!;
  const t = instantDe(avecMontant, 0.95);
  captures.push({ nom: "05-montant-fond-noir", donnees: calque(segs, "karaoke"), instantSec: t, fond: { couleur: "#000000" } });
  captures.push({ nom: "06-montant-illustration-claire", donnees: calque(segs, "karaoke"), instantSec: t, fond: { image: FOND_CLAIR } });
  captures.push({ nom: "07-montant-deuteranopie", donnees: calque(segs, "karaoke"), instantSec: t, fond: { image: FOND_DEMO }, deuteranopie: true });
  captures.push({ nom: "07b-montant-deuteranopie-claire", donnees: calque(segs, "karaoke"), instantSec: t, fond: { image: FOND_CLAIR }, deuteranopie: true });
}

/* --- 3. Le mélange dans une même vidéo (Équilibré), sur un vrai script --- */
const TEXTE_MELANGE =
  "35 heures. C'est le temps perdu chaque semaine. Une personne à temps plein juste pour remplir Excel. " +
  "Il ne voyait qu'une partie des chiffres. Alors on a tout supprimé. Les données sont mises à jour en direct, chaque matin, sans personne pour les saisir.";
// Débit de la voix : 4,4 mots/s (recette avocat), plans de 1,5-2,5 s à l'ouverture puis 2,5-3,5 s.
const motsMelange = horodaterTexte(TEXTE_MELANGE, 4.4);
const melange = fabriquerSousTitres({ texte: TEXTE_MELANGE, dureeSec: motsMelange.at(-1)!.finSec, mots: motsMelange, intensite: "equilibre", emphase: ["Excel", "supprimé", "direct"], coupesSec: [1.9, 3.8, 6.6, 9.5] });
{
  const d = calque(melange, "karaoke");
  const choisis: { nom: string; s: SegmentSousTitres | undefined; part?: number }[] = [
    { nom: "08-melange-1-accroche-impact", s: melange.find((s) => s.style === "impact") },
    { nom: "08-melange-2-base-karaoke", s: melange.find((s, i) => i > 1 && s.style === "base" && s.souligne == null && s.mots.length >= 3), part: 0.45 },
    { nom: "08-melange-3-souligne", s: melange.find((s) => s.souligne != null), part: 0.95 },
    { nom: "08-melange-4-impact-suivant", s: melange.filter((s) => s.style === "impact")[1] },
    { nom: "08-melange-5-bandeau", s: melange.find((s) => s.style === "bandeau") },
    { nom: "08-melange-6-retour-base", s: [...melange].reverse().find((s) => s.style === "base"), part: 0.5 },
  ];
  for (const c of choisis) if (c.s) captures.push({ nom: c.nom, donnees: d, instantSec: instantDe(c.s, c.part ?? 0.7), fond: { image: FOND_DEMO } });
}

/* --- Rendu --- */
const debut = Date.now();
const serveUrl = await bundle({ entryPoint: join(RACINE, "studio-rendu", "compositions", "index.ts") });
const rapport: string[] = [];
for (const c of captures) {
  const inputProps = { donnees: c.donnees, instantSec: c.instantSec, fond: c.fond, deuteranopie: c.deuteranopie };
  const composition = await selectComposition({ serveUrl, id: "ApercuSousTitres", inputProps });
  await renderStill({ composition, serveUrl, output: join(SORTIE, `${c.nom}.png`), frame: 0, inputProps, chromiumOptions: { gl: "swangle" } });
  // Contrôle : largeur rendue (mesure réelle) ≤ zone libre.
  const seg = c.donnees.segments.find((s) => c.instantSec >= s.debutSec && c.instantSec < s.finSec);
  const el = seg ? elementDe(c.donnees, seg, c.instantSec) : null;
  const ligne = el ? `${c.nom} : « ${seg!.mots.map((m) => m.mot).join(" ")} » ${seg!.style ?? "base"} ${Math.round(el.taillePx)} px, largeur ${Math.round(largeurElement(el))} / ${c.donnees.largeurMaxPx} px` : `${c.nom} : (blanc)`;
  rapport.push(ligne);
  console.log(ligne);
}
writeFileSync(
  join(SORTIE, "melange-groupes.txt"),
  melange.map((s) => `${s.debutSec.toFixed(2)}-${s.finSec.toFixed(2)}  ${(s.style ?? "base").padEnd(7)} imp ${s.importance ?? 0}${s.souligne != null ? ` souligné:${s.mots[s.souligne].mot}` : ""}${s.position && s.position !== "auto" ? ` ${s.position}` : ""}${s.inclinaison ? ` ${s.inclinaison}°` : ""}  ${s.mots.map((m) => (m.enValeur ? `[${m.mot}]` : m.mot)).join(" ")}`).join("\n") + "\n",
  "utf-8",
);
writeFileSync(join(SORTIE, "controle-largeurs.txt"), rapport.join("\n") + "\n", "utf-8");
console.log(`${captures.length} captures en ${((Date.now() - debut) / 1000).toFixed(1)} s → ${SORTIE}`);
