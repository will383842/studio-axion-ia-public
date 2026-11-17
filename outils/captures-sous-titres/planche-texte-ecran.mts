/**
 * PLANCHE DE RÉFÉRENCE DU TEXTE À L'ÉCRAN (C2-U15a) — outil local, Remotion `still`, aucun réseau, aucun fournisseur,
 * aucun son, aucune vraie vidéo. Montre à Williams, AVANT tout geste, ce que les pièces déjà fusionnées dessinent :
 *   - marqueur : 3 teintes × 2 cibles (« expression », « mot dit ») ;       - pavé (mot-clé en plaque) ;
 *   - noms d'outils (étiquette dans la ligne, puis étiquette autonome U9) ;  - bandeau « nom et fonction » ;
 *   - les 5 styles de la Bibliothèque (dont « Pastille Axion ») et la Pastille sur 3 textes tirés de `dix-scripts.ts` ;
 *   - le tableau à part (ardoise, tableau blanc, paperboard : bande de fond, Pastille sur l'ardoise) ;
 *   - la sortie animée U19 en 3 instants (avant, pendant, après).
 * En 9:16 et en 16:9, sur fond clair (`fond-clair.jpg`) et sur fond sombre. Les propriétés viennent des fonctions pures
 * du moteur (`src/briques/sous-titres/`, `src/moteurs/montage-tableau/`), jamais écrites à la main. Rien n'est allumé :
 * aucun interrupteur n'est modifié (la « sortie » est montrée par le calcul pur `sortieDuGroupe`, l'interrupteur
 * `SORTIE_ACTIVE` restant éteint ; la Pastille est montrée dans la police de la charte (Manrope) par `enManrope`).
 * Seul un point d'entrée Remotion temporaire est créé dans `studio-rendu/` puis supprimé.
 *
 * Usage (racine) : `pnpm exec tsx outils/captures-sous-titres/planche-texte-ecran.mts`
 * (`studio-rendu` doit avoir ses paquets : `npm ci` dans ce dossier ; `NAVIGATEUR=/chemin/chromium` si besoin.)
 * Sortie : `docs/captures/texte-ecran/`.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SegmentSousTitres, ValeurStyleSousTitres } from "@/domaine/types";
import type { TeinteMarqueur, CibleMarqueur } from "@/domaine/texte-ecran";
import * as moduleBrique from "@/briques/sous-titres";
import * as moduleStyles from "@/donnees/styles-texte-ecran";
import * as moduleTableau from "@/moteurs/montage-tableau/sous-titres-tableau";
import * as moduleBandeau from "@/briques/sous-titres/bandeau-nom";
import * as moduleOutils from "@/briques/sous-titres/noms-outils";
import * as moduleSortie from "@/briques/sous-titres/sortie";
import * as moduleStyleTableau from "@/briques/tableau-scene/trois-styles/styles";
import * as moduleFormats from "@/briques/formats-facecam/sous-titres";
import * as moduleScripts from "../../tests/briques/faits-script/dix-scripts";

/** Les modules sont lus en CommonJS par tsx : leurs exports peuvent être sur `default`. */
const lire = <T,>(m: T): T => ((m as unknown as { default?: T }).default ?? m) as T;
const brique = lire(moduleBrique);
const styles = lire(moduleStyles);
const tableau = lire(moduleTableau);
const bandeauNom = lire(moduleBandeau);
const outils = lire(moduleOutils);
const sortieMod = lire(moduleSortie);
const styleTableau = lire(moduleStyleTableau);
const formats = lire(moduleFormats);
const { DIX_SCRIPTS } = lire(moduleScripts);
const { appliquerChoixGroupe, donneesCalque, fabriquerSousTitres, PASTILLE_AXION, PASTILLE_AXION_ARDOISE, dimensions } = brique;

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, "..", "..");
const SORTIE = join(RACINE, "docs", "captures", "texte-ecran");
mkdirSync(SORTIE, { recursive: true });

type DonneesCalque = ReturnType<typeof donneesCalque>;
type Ratio = "9:16" | "16:9";
const RATIOS: Ratio[] = ["9:16", "16:9"];
const NOM_RATIO: Record<Ratio, string> = { "9:16": "9x16", "16:9": "16x9" };
const RESEAUX = ["tiktok", "instagram", "facebook", "youtube-shorts"] as const;
const FOND_CLAIR = `data:image/jpeg;base64,${readFileSync(join(ICI, "fond-clair.jpg")).toString("base64")}`;
type Fond = { couleur?: string; image?: string };
const FONDS: Record<"clair" | "sombre", Fond> = { clair: { image: FOND_CLAIR }, sombre: { couleur: "#16120F" } };

/** Une case de la planche : un calque dessiné à un instant, sur un fond, avec sa légende. */
interface Cellule {
  legende: string;
  donnees: DonneesCalque;
  instantSec: number;
  fond: Fond;
  /** Sortie animée simulée par le calcul pur (opacité, décalage en px de l'image). */
  sortie?: { opacite: number; decalageYPx: number };
  /** Bande de fond / tableau : couleur du fond de page de la case (remplace `fond`). */
  note?: string;
}
interface Planche {
  nom: string;
  titre: string;
  ratio: Ratio;
  colonnes: number;
  cellules: Cellule[];
}
const planches: Planche[] = [];
const rapport: string[] = [];

/** Style de Bibliothèque de base : copies des valeurs de la migration 25 (jamais modifiées). */
const avecMarqueur = (teinte: TeinteMarqueur, cible: CibleMarqueur): ValeurStyleSousTitres => ({ ...styles.VALEUR_AXION_SURLIGNE, texteEcran: { marqueur: { teinte, cible } } });

const premiereFraseDe = (i: number) => DIX_SCRIPTS[i].split(/(?<=[.!?])\s+/)[0];

/** Groupes d'un texte, par le moteur (voix simulée : débit régulier). */
function groupes(texte: string, o: { style?: ValeurStyleSousTitres; emphase?: string[]; mini?: number } = {}): SegmentSousTitres[] {
  const mots = texte.split(/\s+/).length;
  const segs = fabriquerSousTitres({ texte, dureeSec: Math.max(2, mots / 4.4), intensite: "sobre", emphase: o.emphase ?? [], style: o.style ?? null });
  return segs.length ? segs : [];
}
/** Instant où un mot de rang `k` du groupe est dit (+ marge), sinon milieu du groupe. */
const instantMot = (s: SegmentSousTitres, k?: number) => (k !== undefined && s.mots[k] ? Math.min(s.finSec - 0.02, s.mots[k].debutSec + 0.25) : (s.debutSec + s.finSec) / 2);
const motsLong = (s: SegmentSousTitres) => s.mots.length;

function calque(segments: SegmentSousTitres[], ratio: Ratio, style: ValeurStyleSousTitres | null, extra: Partial<DonneesCalque> = {}): DonneesCalque {
  const d = donneesCalque({ segments, base: "karaoke", ratio, reseaux: [...RESEAUX], style });
  // Hors du vertical : même échelle de lettre que la face caméra (0,9 en 16:9), largeur libre prise telle quelle.
  const e = ratio === "16:9" ? formats.echelleTexteFormat("16:9") : undefined;
  return { ...d, ...(e !== undefined ? { echelleTexte: e } : {}), ...extra };
}

/** Groupe de base de 3 à 5 mots où le mot `k` existe (marqueur) : le premier qui convient. */
function groupeMarque(texte: string, emphase: string[]): { seg: SegmentSousTitres; k: number } {
  const segs = groupes(texte, { emphase });
  const seg = segs.find((s) => motsLong(s) >= 3) ?? segs[0];
  const k = Math.min(1, seg.mots.length - 1);
  return { seg, k };
}

/* ---------- 1. Marqueur : 3 teintes × 2 cibles ---------- */
const TEXTE_MARQUEUR = premiereFraseDe(0); // « Vous perdez deux heures par jour à répondre aux mêmes mails. »
const TEINTES: TeinteMarqueur[] = ["terracotta", "ivoire", "ardoise"];
const CIBLES: CibleMarqueur[] = ["expression", "mot-dit"];
for (const ratio of RATIOS) {
  for (const [nomFond, fond] of Object.entries(FONDS)) {
    const cellules: Cellule[] = [];
    for (const cible of CIBLES) {
      for (const teinte of TEINTES) {
        const style = avecMarqueur(teinte, cible);
        const { seg, k } = groupeMarque(TEXTE_MARQUEUR, []);
        const [pose] = appliquerChoixGroupe([seg], seg.id, "souligner", k);
        const d = calque([pose], ratio, style);
        cellules.push({ legende: `${teinte} · cible « ${cible} »`, donnees: d, instantSec: cible === "mot-dit" ? instantMot(pose, k) : pose.finSec - 0.05, fond });
      }
    }
    planches.push({ nom: `marqueur-${NOM_RATIO[ratio]}-${nomFond}`, titre: "Marqueur : 3 teintes × 2 cibles (U5, U6)", ratio, colonnes: ratio === "9:16" ? 3 : 2, cellules });
  }
}

/* ---------- 2. Pavé (mot-clé en plaque) ---------- */
const TEXTES_PAVE = [premiereFraseDe(1).replace(/Un artisan/, "Un artisan"), premiereFraseDe(3), premiereFraseDe(4)];
const reglesPave: ("forts" | "chiffres" | "forts-et-chiffres")[] = ["forts", "chiffres", "forts-et-chiffres"];
for (const ratio of RATIOS) {
  for (const [nomFond, fond] of Object.entries(FONDS)) {
    const cellules: Cellule[] = [];
    for (const regle of reglesPave) {
      const style: ValeurStyleSousTitres = { ...styles.VALEUR_AXION_PAVE, texteEcran: { pave: { mots: regle } } };
      // Texte où la règle trouve un mot : le premier texte dont un groupe reçoit une plaque.
      let trouve: { seg: SegmentSousTitres; d: DonneesCalque } | undefined;
      for (const t of [...TEXTES_PAVE, premiereFraseDe(2), premiereFraseDe(5)]) {
        for (const s of groupes(t, { style })) {
          const d = calque([s], ratio, style);
          if (d.plaques && d.plaques[s.id] !== undefined && !trouve) trouve = { seg: s, d };
        }
        if (trouve) break;
      }
      if (trouve) cellules.push({ legende: `pavé « ${regle} »`, donnees: trouve.d, instantSec: trouve.seg.finSec - 0.05, fond });
      else rapport.push(`pavé ${regle} : aucun mot trouvé sur les textes de contrôle`);
    }
    planches.push({ nom: `pave-${NOM_RATIO[ratio]}-${nomFond}`, titre: "Pavé : mot-clé en plaque (U7a, U7b)", ratio, colonnes: ratio === "9:16" ? 3 : 2, cellules });
  }
}

/* ---------- 3. Noms d'outils : étiquette dans la ligne (U8) et étiquette autonome (U9) ---------- */
const TEXTE_OUTILS = "Je prépare mes mails avec ChatGPT puis je les range avec Notion.";
for (const ratio of RATIOS) {
  for (const [nomFond, fond] of Object.entries(FONDS)) {
    const cellules: Cellule[] = [];
    const style = styles.VALEUR_AXION_OUTILS;
    const segs = groupes(TEXTE_OUTILS, { style });
    const avecOutil = segs.filter((s) => outils.motsOutils(s).length > 0);
    for (const s of avecOutil.slice(0, 2)) {
      const d = calque([s], ratio, style);
      cellules.push({ legende: `étiquette dans la ligne (« ${s.mots.map((m) => m.mot).join(" ")} »)`, donnees: d, instantSec: instantMot(s), fond });
    }
    // U9 : étiquette autonome, posée par la fonction pure en forçant `actif` (l'interrupteur reste éteint ailleurs).
    const duree = Math.max(...segs.map((s) => s.finSec));
    const posees = outils.etiquettesAutonomes(segs, duree + 2, { actif: true });
    if (posees[0]) {
      const d = calque(segs, ratio, styles.VALEUR_AXION_OUTILS, { etiquettesOutils: posees });
      cellules.push({ legende: `étiquette autonome « ${posees[0].texte} »`, donnees: d, instantSec: posees[0].debutSec + 0.5, fond });
    } else rapport.push("noms d'outils : aucune étiquette autonome posée");
    planches.push({ nom: `outils-${NOM_RATIO[ratio]}-${nomFond}`, titre: "Noms d'outils : texte seul, jamais de logo (U8, U9)", ratio, colonnes: ratio === "9:16" ? 3 : 2, cellules });
  }
}

/* ---------- 4. Bandeau « nom et fonction » (U10, U11) ---------- */
for (const ratio of RATIOS) {
  for (const [nomFond, fond] of Object.entries(FONDS)) {
    const cellules: Cellule[] = [];
    const segs = groupes(premiereFraseDe(2) + " " + premiereFraseDe(3));
    const base = calque(segs, ratio, null);
    for (const [nom, fonction] of [["Claire Martin", "Avocate en droit du travail"], ["Jean-Baptiste Delacroix-Martin", "Directeur de la transformation"]] as const) {
      const b = bandeauNom.poserBandeauNom({ nom, fonction, dureeVideoSec: 12, largeur: base.largeur, hauteur: base.hauteur, zone: { haut: 8, droite: 8, bas: 14, gauche: 8 }, basPct: base.positions.basPct });
      if (!b) {
        rapport.push(`bandeau « ${nom} » refusé par la règle pure (${ratio}) : aucune case`);
        continue;
      }
      cellules.push({ legende: `bandeau : ${nom}`, donnees: { ...base, bandeauNom: b }, instantSec: b.debutSec + 1.2, fond });
    }
    planches.push({ nom: `bandeau-nom-${NOM_RATIO[ratio]}-${nomFond}`, titre: "Bandeau « nom et fonction » (U10, U11)", ratio, colonnes: ratio === "9:16" ? 2 : 1, cellules });
  }
}

/* ---------- 5. Les 5 styles de la Bibliothèque, puis la Pastille sur 3 textes ---------- */
const CINQ = [
  { nom: "Axion surligné", valeur: styles.VALEUR_AXION_SURLIGNE },
  { nom: "Axion pavé", valeur: styles.VALEUR_AXION_PAVE },
  { nom: "Axion outils", valeur: styles.VALEUR_AXION_OUTILS },
  { nom: "Axion varié", valeur: styles.VALEUR_AXION_VARIE },
  { nom: "Pastille Axion (en Manrope, U14)", valeur: styles.VALEUR_PASTILLE_AXION },
];
const TEXTE_STYLES = "Avec ChatGPT, on passe de 2 heures à 20 minutes sur ses mails.";
/** Pastille montrée en Manrope Bold (police de la charte) : variante `enManrope: true` de la pièce, sans toucher l'interrupteur. */
const pastilleManrope = { ...PASTILLE_AXION, enManrope: true as const };
const pastilleArdoiseManrope = { ...PASTILLE_AXION_ARDOISE, enManrope: true as const };
for (const ratio of RATIOS) {
  for (const [nomFond, fond] of Object.entries(FONDS)) {
    const cellules: Cellule[] = [];
    for (const c of CINQ) {
      const segs = groupes(TEXTE_STYLES, { style: c.valeur, emphase: ["heures"] });
      const choisi = segs.find((s) => s.mots.some((m) => outils.motsOutils({ mots: [m] }).length > 0 || /\d/.test(m.mot))) ?? segs[0];
      const d0 = calque([choisi], ratio, c.valeur);
      const d = d0.pastille ? { ...d0, pastille: pastilleManrope } : d0;
      cellules.push({ legende: c.nom, donnees: d, instantSec: instantMot(choisi, Math.min(1, choisi.mots.length - 1)), fond });
    }
    planches.push({ nom: `styles-${NOM_RATIO[ratio]}-${nomFond}`, titre: "Les 5 styles de la Bibliothèque (U12, U13, migration 25 inactive)", ratio, colonnes: ratio === "9:16" ? 3 : 2, cellules });
    // Pastille sur 3 textes de vidéos réelles (dix-scripts.ts), pas de vraie vidéo.
    const trois: Cellule[] = [];
    for (const i of [0, 5, 9]) {
      const texte = premiereFraseDe(i);
      const segs = groupes(texte, { style: styles.VALEUR_PASTILLE_AXION });
      const choisi = segs[Math.min(1, segs.length - 1)];
      const d = { ...calque([choisi], ratio, styles.VALEUR_PASTILLE_AXION), pastille: pastilleManrope };
      trois.push({ legende: `script ${i + 1} : « ${texte.slice(0, 52)}${texte.length > 52 ? "…" : ""} »`, donnees: d, instantSec: instantMot(choisi, Math.min(1, choisi.mots.length - 1)), fond });
    }
    planches.push({ nom: `pastille-3-textes-${NOM_RATIO[ratio]}-${nomFond}`, titre: "Pastille Axion sur 3 textes de vidéos réelles (dix-scripts.ts)", ratio, colonnes: ratio === "9:16" ? 3 : 2, cellules: trois });
  }
}

/* ---------- 6. Le tableau à part : 3 fonds du tableau, bande de fond, Pastille sur l'ardoise ---------- */
{
  const TEXTE_TABLEAU = "Trois jours de saisie en moins chaque mois, sans effort.";
  for (const ratio of RATIOS) {
    const cellules: Cellule[] = [];
    const { largeur, hauteur } = dimensions(ratio);
    // Bande réservée aux sous-titres : une maquette de mise en page (bas de l'image), simulée ici ; le calcul reste celui du moteur.
    const bande = { y: hauteur * 0.74, hauteur: hauteur * 0.2, largeur };
    for (const styleId of styleTableau.STYLES_TABLEAU as readonly string[]) {
      const fiche = { habillage: "reference-3", styleTableau: styleId } as Parameters<typeof tableau.fondSousTitresTableau>[0];
      const fondInfo = tableau.fondSousTitresTableau(fiche);
      const st = tableau.sousTitresTableau({ fiche, positionPct: ((bande.y + bande.hauteur / 2) / hauteur) * 100, bande: { hauteurPx: bande.hauteur, echelle: ratio === "9:16" ? 1 : 0.9, largeurPct: 84, hauteurImagePx: hauteur } });
      const segs = tableau.sousTitresDynamiquesTableau(groupes(TEXTE_TABLEAU, { emphase: ["Trois", "jours"] }), { st, intensite: "equilibre" });
      const choisi = segs[0];
      const bandeFond = tableau.bandeFondCalque(st, bande, largeur);
      const d = donneesCalque({ segments: [choisi], base: st.base, ratio, reseaux: [...RESEAUX], style: st.style.valeur });
      const echelle = st.echelle ?? (ratio === "9:16" ? undefined : 0.9);
      cellules.push({
        legende: `tableau « ${styleId} »${bandeFond ? " · bande de fond" : " · sans bande"}`,
        donnees: { ...d, ...(echelle !== undefined ? { echelleTexte: echelle } : {}), ...(bandeFond ? { bandeFond } : {}), glissement: false },
        instantSec: instantMot(choisi, 1),
        fond: { couleur: fondInfo.teinte },
      });
      if (styleId === "ardoise") {
        const segsP = groupes(TEXTE_TABLEAU, { style: styles.VALEUR_PASTILLE_AXION });
        const dP = { ...calque([segsP[0]], ratio, styles.VALEUR_PASTILLE_AXION), pastille: pastilleArdoiseManrope };
        cellules.push({ legende: "Pastille Axion sur l'ardoise (bord gris)", donnees: dP, instantSec: instantMot(segsP[0], 1), fond: { couleur: fondInfo.teinte } });
      }
    }
    planches.push({ nom: `tableau-${NOM_RATIO[ratio]}`, titre: "Le tableau à part : fonds du tableau (bande réservée simulée)", ratio, colonnes: ratio === "9:16" ? 4 : 2, cellules });
  }
}

/* ---------- 7. Sortie animée U19 : avant, pendant, après ---------- */
for (const ratio of RATIOS) {
  for (const [nomFond, fond] of Object.entries(FONDS)) {
    const segs = groupes(premiereFraseDe(4), { style: styles.VALEUR_PASTILLE_AXION });
    const s = segs[0];
    const sortie = sortieMod.SORTIE_PAR_DEFAUT;
    const d = { ...calque([s], ratio, styles.VALEUR_PASTILLE_AXION), pastille: pastilleManrope, sortie };
    const mi = sortieMod.sortieDuGroupe(sortie, s.finSec, s.finSec + sortie.dureeSec / 2);
    const echelleImage = d.largeur / 1080;
    rapport.push(`sortie ${ratio}/${nomFond} : mi-sortie opacité ${mi?.opacite.toFixed(2)}, glissement ${((mi?.decalageYPx ?? 0) * echelleImage).toFixed(1)} px`);
    const cellules: Cellule[] = [
      { legende: "avant la sortie (groupe en place)", donnees: d, instantSec: s.finSec - 0.05, fond },
      // Le calque ne dessine PAS la sortie tant que SORTIE_ACTIVE vaut false : l'état « pendant » est le groupe de la
      // dernière image, passé dans le fondu et le glissement calculés par `sortieDuGroupe` (simulation, rien d'allumé).
      { legende: `pendant (mi-sortie : opacité ${mi?.opacite.toFixed(2)}, glissement ${mi?.decalageYPx.toFixed(0)} px) — simulé`, donnees: d, instantSec: s.finSec - 0.02, fond, sortie: { opacite: mi?.opacite ?? 0.5, decalageYPx: (mi?.decalageYPx ?? 0) * echelleImage } },
      { legende: "après la sortie (disparu)", donnees: d, instantSec: s.finSec + sortie.dureeSec + 0.05, fond },
    ];
    planches.push({ nom: `sortie-u19-${NOM_RATIO[ratio]}-${nomFond}`, titre: `Sortie animée (U19) : ${sortie.dureeSec} s, glissement ${sortie.glissementPx} px, sans rebond — interrupteur éteint`, ratio, colonnes: ratio === "9:16" ? 3 : 2, cellules });
  }
}

/* ---------- Point d'entrée Remotion temporaire ---------- */
const LARGEUR_CELLULE: Record<Ratio, number> = { "9:16": 300, "16:9": 620 };
const GOUTTIERE = 16;
const ENTETE = 56;
const LEGENDE = 52;
const mesure = (p: Planche) => {
  const l = LARGEUR_CELLULE[p.ratio];
  const h = Math.round((l * (p.ratio === "9:16" ? 1920 : 1080)) / (p.ratio === "9:16" ? 1080 : 1920));
  const lignes = Math.ceil(p.cellules.length / p.colonnes);
  const cols = Math.min(p.colonnes, p.cellules.length) || 1;
  return { l, h, largeur: Math.max(760, GOUTTIERE + cols * (l + GOUTTIERE)), hauteur: ENTETE + lignes * (h + LEGENDE + GOUTTIERE) + GOUTTIERE };
};

const dossierTmp = join(RACINE, "studio-rendu", ".planche-texte-tmp");
mkdirSync(dossierTmp, { recursive: true });
writeFileSync(
  join(dossierTmp, "index.tsx"),
  `import React from "react";
import { AbsoluteFill, Composition, Img, registerRoot } from "remotion";
import { CalqueSousTitres } from "../compositions/sous-titres/CalqueSousTitres";
const Case: React.FC<any> = ({ c, l, h }) => {
  const d = c.donnees;
  const k = l / d.largeur;
  return (
    <div style={{ width: l }}>
      <div style={{ width: l, height: h, overflow: "hidden", position: "relative", background: c.fond.couleur ?? "#888", borderRadius: 6 }}>
        <div style={{ width: d.largeur, height: d.hauteur, transform: "scale(" + k + ")", transformOrigin: "0 0", position: "absolute", left: 0, top: 0 }}>
          {c.fond.image ? <Img src={c.fond.image} style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", left: 0, top: 0 }} /> : null}
          <div style={{ position: "absolute", inset: 0, opacity: c.sortie ? c.sortie.opacite : 1, transform: c.sortie ? "translateY(" + c.sortie.decalageYPx + "px)" : undefined }}>
            <CalqueSousTitres donnees={d} instantSec={c.instantSec} />
          </div>
        </div>
      </div>
      <div style={{ height: ${LEGENDE}, paddingTop: 8, fontFamily: "sans-serif", fontSize: 15, lineHeight: "18px", color: "#222" }}>{c.legende}</div>
    </div>
  );
};
const Planche: React.FC<any> = ({ titre, l, h, colonnes, cellules, pied }) => (
  <AbsoluteFill style={{ background: "#F4F1EA", fontFamily: "sans-serif" }}>
    <div style={{ height: ${ENTETE}, padding: "16px ${GOUTTIERE}px 0", fontSize: 24, fontWeight: 700, color: "#141413" }}>{titre}</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(" + colonnes + ", " + l + "px)", gap: ${GOUTTIERE}, padding: "0 ${GOUTTIERE}px" }}>
      {cellules.map((c: any, i: number) => <Case key={i} c={c} l={l} h={h} />)}
    </div>
  </AbsoluteFill>
);
registerRoot(() => (<>${planches
    .map((p) => {
      const m = mesure(p);
      return `<Composition id="${p.nom}" component={Planche} width={${m.largeur}} height={${m.hauteur}} fps={25} durationInFrames={1} defaultProps={{}} />`;
    })
    .join("")}</>));
`,
);

const exiger = createRequire(join(RACINE, "studio-rendu", "package.json"));
type Composition = { width: number; height: number };
const { bundle } = exiger("@remotion/bundler") as { bundle: (o: { entryPoint: string }) => Promise<string> };
const { renderStill, selectComposition } = exiger("@remotion/renderer") as {
  selectComposition: (o: { serveUrl: string; id: string; inputProps: Record<string, unknown>; browserExecutable?: string | null }) => Promise<Composition>;
  renderStill: (o: { composition: Composition; serveUrl: string; output: string; frame: number; inputProps: Record<string, unknown>; chromiumOptions?: { gl?: string }; browserExecutable?: string | null }) => Promise<unknown>;
};
const browserExecutable = process.env.NAVIGATEUR ?? null;
const debut = Date.now();
try {
  const serveUrl = await bundle({ entryPoint: join(dossierTmp, "index.tsx") });
  for (const p of planches) {
    if (!p.cellules.length) {
      rapport.push(`${p.nom} : aucune case, planche non produite`);
      continue;
    }
    const m = mesure(p);
    const inputProps = { titre: p.titre, l: m.l, h: m.h, colonnes: p.colonnes, cellules: p.cellules };
    const composition = await selectComposition({ serveUrl, id: p.nom, inputProps, browserExecutable });
    await renderStill({ composition, serveUrl, output: join(SORTIE, `${p.nom}.png`), frame: 0, inputProps, chromiumOptions: { gl: "swangle" }, browserExecutable });
    rapport.push(`${p.nom}.png : ${p.cellules.length} case(s)`);
    console.log(`${p.nom}.png`);
  }
} finally {
  rmSync(dossierTmp, { recursive: true, force: true });
}
const duree = ((Date.now() - debut) / 1000).toFixed(1);
rapport.push(`Temps de rendu total : ${duree} s`);
writeFileSync(join(SORTIE, "planche.txt"), rapport.join("\n") + "\n");
console.log(rapport.join("\n"));
