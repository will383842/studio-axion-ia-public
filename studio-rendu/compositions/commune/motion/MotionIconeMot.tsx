/**
 * Modèle 8 — ICÔNE + MOT (lot F2) : un anneau se dessine, l'icône s'y trace trait par trait puis respire ; au mot
 * dit, le mot géant se construit lettre à lettre (3D, flou de mouvement), en orange, se souligne, et ce qu'il veut
 * dire arrive dessous. Graduations qui tournent, halo qui respire : rien de figé.
 */
import type { MiseEnPageCarte } from "../../../../src/briques/motion/types";
import type { DonneesIconeMot } from "../../../../src/briques/motion/types-etendus";
import { couperLignes, tailleQuiTient } from "../../../../src/briques/motion/mesure";
import { avecOpacite, CarteMotion, COULEURS, DUREES, echelleRessort, IconeTracee, progres, TexteCinetique, Trait, useMotion, type Zone } from "./noyau";
import { IconeMotSpectaculaire } from "./spectaculaire/IconeMotSpectaculaire";

/** Le mot avec son marquage orange : tel quel s'il porte des *astérisques*, sinon tout entier. */
export const motMarque = (mot: string) => (mot.includes("*") ? mot : `*${mot.trim()}*`);

/**
 * Géométrie commune aux deux styles. Plein écran : icône au centre, le mot et son sens dessous. Moitié haute (écran
 * partagé) : icône à gauche, sur-titre, mot et sens à droite — tout tient dans la demi-image.
 */
export function geometrieIconeMot(d: DonneesIconeMot, z: Zone, cote: boolean, u: number, tailles: { affiche: number; titre: number; corps: number; legende: number }, mesurer: (texte: string, taille: number, graisse: number, largeur: number, niveau: "affiche" | "corps") => number, echelleIcone = 1) {
  const mot = d.mot.replace(/\*/g, "");
  // Sur-titre en capitales espacées de 0,16 em, à côté d'un trait (deux s'il est centré) : souvent 2 lignes en écran
  // partagé (Vérif V2, 10/10 : le mot géant recouvrait sa 2e ligne). Chaque ligne en plus décale tout le reste.
  const lignesSur = d.surTitre ? Math.max(1, couperLignes(d.surTitre.toUpperCase(), tailles.legende, 700, z.largeur - (cote ? 1 : 2) * 92 * u, 0.16).length) : 0;
  const hSur = d.surTitre ? tailles.legende * (1.4 + 1.25 * (lignesSur - 1)) + 34 * u : 0;
  if (cote) {
    // Sur-titre en tête (pleine largeur), puis l'icône à gauche et le mot avec son sens à droite.
    const R0 = Math.min((z.hauteur - hSur) * 0.4, z.largeur * 0.17) * echelleIcone;
    const cx = z.x + R0 + 24 * u;
    const x = cx + R0 + 64 * u;
    const largeur = z.x + z.largeur - x;
    const tailleMot = tailleQuiTient(mot, Math.round(tailles.affiche * 1.1), 900, largeur, tailles.titre, -0.035);
    const hMot = mesurer(mot, tailleMot, 900, largeur, "affiche");
    const hSous = d.sousTitre ? mesurer(d.sousTitre, tailles.corps, 600, largeur, "corps") + 30 * u : 0;
    const hTexte = hMot + 46 * u + hSous;
    const hCorps = Math.max(2 * R0 + 40 * u, hTexte);
    const haut = z.y + Math.max(0, (z.hauteur - hSur - hCorps) / 2);
    return { cote, R: R0, icone: Math.round(R0 / 0.92), cx, cy: haut + hSur + hCorps / 2, tailleMot, hMot, hSur, haut, sur: { x: z.x, largeur: z.largeur }, texte: { x, y: haut + hSur + (hCorps - hTexte) / 2, largeur, centre: false } };
  }
  const icone = Math.round(Math.min(z.largeur * 0.4, z.hauteur * 0.2) * echelleIcone);
  const R = icone * 0.92;
  const tailleMot = tailleQuiTient(mot, Math.round(tailles.affiche * 1.32), 900, z.largeur, tailles.titre, -0.035);
  const hMot = mesurer(mot, tailleMot, 900, z.largeur, "affiche");
  const hSous = d.sousTitre ? mesurer(d.sousTitre, tailles.corps, 600, z.largeur * 0.9, "corps") + 30 * u : 0;
  const total = hSur + 2 * R + 60 * u + hMot + 46 * u + hSous;
  const haut = z.y + Math.max(0, (z.hauteur - total) / 2);
  const cy = haut + hSur + R;
  return { cote, R, icone, cx: z.x + z.largeur / 2, cy, tailleMot, hMot, hSur, haut, sur: { x: z.x, largeur: z.largeur }, texte: { x: z.x, y: cy + R + 60 * u, largeur: z.largeur, centre: true } };
}

function Contenu({ d }: { d: DonneesIconeMot }) {
  const { t, u, zoneCentree: z, taille, chute, largeur, mesurer, moitie } = useMotion();
  const tMot = Math.max(0.85, d.aSec ?? 0.85);
  const g = geometrieIconeMot(d, z, moitie, u, { affiche: taille("affiche"), titre: taille("titre"), corps: taille("corps"), legende: taille("legende") }, (tx, ta, gr, l, n) => mesurer(tx, n, l, gr, ta));
  const { R, cx, cy, icone } = g;
  const s = progres(t, chute, DUREES.sortie, "sortie");
  const anneau = progres(t, 0.12, 0.75, "glisse");
  const pose = progres(t, 0.9, 0.5);
  const respire = 1 + 0.03 * Math.sin((t - 0.9) * 2.4) * pose;
  const nbLettres = d.mot.replace(/\s|\*/g, "").length;
  const finMot = tMot + nbLettres * DUREES.decalageLettre + DUREES.entreeLongue;
  return (
    <>
      <div style={{ position: "absolute", left: cx - R * 1.9, top: cy - R * 1.9, width: R * 3.8, height: R * 3.8, borderRadius: "50%", background: `radial-gradient(circle, ${avecOpacite(COULEURS.orange, 0.32 * (0.7 + 0.3 * Math.sin(t * 2.2)))}, ${avecOpacite(COULEURS.orange, 0)} 62%)`, opacity: progres(t, 0.1, 0.8) * (1 - s) }} />
      {d.surTitre && (
        <div style={{ position: "absolute", left: g.sur.x, width: g.sur.largeur, top: g.haut, display: "flex", alignItems: "center", justifyContent: g.texte.centre ? "center" : "flex-start", gap: 22 * u, opacity: 1 - s }}>
          {g.texte.centre && <Trait debut={0.05} largeur={70 * u} epaisseur={Math.max(3, 4 * u)} style={{ transform: "scaleX(-1)" }} />}
          <TexteCinetique texte={d.surTitre.toUpperCase()} niveau="legende" debut={0.1} couleur={COULEURS.orangeVif} graisse={700} style={{ letterSpacing: "0.16em" }} />
          <Trait debut={0.05} largeur={70 * u} epaisseur={Math.max(3, 4 * u)} />
        </div>
      )}
      <svg width={largeur} height={cy + R * 1.5} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: 1 - s, transform: `scale(${(0.88 + 0.12 * echelleRessort(t, 0.08, chute + 9)).toFixed(4)})`, transformOrigin: `${cx}px ${cy}px` }}>
        <g transform={`rotate(${(-t * 7).toFixed(3)} ${cx} ${cy})`} opacity={0.55 * progres(t, 0.2, 0.8)}>
          {Array.from({ length: 48 }, (_, i) => {
            const a = (i / 48) * Math.PI * 2;
            const r1 = R + 26 * u;
            const r2 = r1 + (i % 4 === 0 ? 20 : 9) * u;
            return <line key={i} x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)} x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)} stroke={i % 4 === 0 ? COULEURS.cremeAttenuee : COULEURS.filet} strokeWidth={Math.max(1.5, 2.5 * u)} strokeLinecap="round" />;
          })}
        </g>
        <circle cx={cx} cy={cy} r={R} fill={avecOpacite(COULEURS.surface, 0.85)} stroke={COULEURS.surfaceHaute} strokeWidth={Math.max(4, 6 * u)} />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={COULEURS.orangeVif} strokeWidth={Math.max(5, 8 * u)} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={(1 - anneau).toFixed(4)} transform={`rotate(-90 ${cx} ${cy})`} style={{ filter: `drop-shadow(0 0 ${12 * u}px ${avecOpacite(COULEURS.orangeVif, 0.6)})` }} />
      </svg>
      <div style={{ position: "absolute", left: cx - icone * 0.5, top: cy - icone * 0.5, width: icone, height: icone, opacity: 1 - s, transform: `scale(${respire.toFixed(4)})` }}>
        <IconeTracee nom={d.icone} taille={icone} debut={0.3} couleur={COULEURS.creme} epaisseur={1.9} duree={0.85} />
      </div>
      <div style={{ position: "absolute", left: g.texte.x, width: g.texte.largeur, top: g.texte.y, display: "flex", flexDirection: "column", alignItems: g.texte.centre ? "center" : "flex-start", gap: 26 * u }}>
        <div style={{ textShadow: `0 ${8 * u}px ${40 * u}px ${avecOpacite(COULEURS.fondProfond, 0.8)}` }}>
          <TexteCinetique texte={motMarque(d.mot)} niveau="affiche" mode="lettres" debut={tMot} alignement={g.texte.centre ? "center" : "left"} graisse={900} taillePx={g.tailleMot} largeurMax={g.texte.largeur} />
        </div>
        <Trait debut={finMot - 0.25} largeur={g.texte.largeur * (g.texte.centre ? 0.24 : 0.4)} epaisseur={Math.max(5, 8 * u)} />
        {d.sousTitre && <TexteCinetique texte={d.sousTitre} niveau="corps" debut={finMot - 0.05} alignement={g.texte.centre ? "center" : "left"} couleur={COULEURS.cremeAttenuee} graisse={600} largeurMax={g.texte.largeur * (g.texte.centre ? 0.9 : 1)} />}
      </div>
    </>
  );
}

export function MotionIconeMot(p: MiseEnPageCarte & { donnees: DonneesIconeMot }) {
  if (p.style === "spectaculaire") return <IconeMotSpectaculaire {...p} />;
  return (
    <CarteMotion mp={p} intensiteLumiere={1.15}>
      <Contenu d={p.donnees} />
    </CarteMotion>
  );
}
