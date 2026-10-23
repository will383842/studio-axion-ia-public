import React from "react";
/**
 * n° 10 `carte-verre` (lot C, standard v3 § D, G) : la carte d'interface en verre ivoire qui TOMBE du haut en 3D (rotateX de
 * -22° à 0, mise au point en 4 images) pendant que la prise DESCEND dessous (descente permise par Will), se remplit de
 * VRAI texte sur les mots (chaque ligne apparaît quand elle se tape : un squelette sable la précède 4 images, puis le texte
 * se révèle ; ligne citée en halo orange), puis REMONTE en fouet.
 *
 * Emplacement : x 0,08-0,92, y 0,05-0,39 (0,34 H). Ressorts : VERRE (chute), PIVOT (rotation), FOUET (remontée).
 * Visage : entier — la prise descend de `DESCENTE_PRISE` avant que la carte n'arrive sur ses cheveux (voir `descentePrise`).
 * Aucun chiffre : la pastille « n/N » de la référence devient une rangée de points qui se remplissent.
 * Textes : tous ≥ 52 px à 1080 de large (26 px à 540).
 */
import { Icone } from "../../elements";
import { alpha, borne01, courbe, Flou, halo, lerp, microVie, NUANCES, Perspective, PropsElement, ReflePassant, ressort, SonElement, Squelette, styleOrange, styleVerre, styleVerreEncre, texte, titre, vitesse } from "./commun-lotC";

export type LigneCarte = { texte: string; icone?: string; a: number };
export type PropsCarteVerre = PropsElement & {
  titre?: string;
  iconeTitre?: string;
  /** Lignes dites par Will : `a` = image (depuis le début de l'élément) où le mot est prononcé. */
  lignes?: LigneCarte[];
  /** Image où la carte remonte (sortie en fouet). */
  sortieA?: number;
};

const LIGNES_DEMO: LigneCarte[] = [
  { texte: "Relancer les devis", a: 8 },
  { texte: "Qualifier les demandes", a: 20 },
  { texte: "Caler les rendez-vous", a: 32 },
  { texte: "Envoyer les factures", a: 44 },
];

export const SONS_CARTE_VERRE: readonly SonElement[] = [
  [1, "drop_003", 0.8],
  [8, "tick_001", 0.5],
  [20, "tick_001", 0.5],
  [32, "tick_001", 0.5],
  [44, "tick_001", 0.5],
  [62, "whoosh-out", 0.55],
];

/** Descente de la prise (fraction de H) : la carte (bas à 0,39 H) ne touche jamais les cheveux (haut à 0,14 H → 0,41 H). */
export const DESCENTE_PRISE = 0.27;

/**
 * Décalage (fraction de H) à appliquer à la prise pendant la carte : 3 images vers le bas avec ≈ 6 % de dépassement
 * (comme `DESCENTE` de `cadrage.ts`), remontée 1,5 image après la sortie de la carte, en 3,5 images.
 */
export function descentePrise(i: number, sortieA: number, hauteur = DESCENTE_PRISE): number {
  const bas = courbe(i, 0, 3, (x) => 1 - Math.pow(1 - x, 3) + 0.06 * Math.sin(Math.PI * x) * x);
  const haut = courbe(i, sortieA + 1.5, 3.5, (x) => x * x * (3 - 2 * x));
  return hauteur * bas * (1 - haut);
}

export function CarteVerre({ i, W = 1080, H = 1920, titre: titreCarte = "Automatisé", iconeTitre = "eclair", lignes = LIGNES_DEMO, sortieA = 62 }: PropsCarteVerre) {
  const sortie = (j: number) => ressort("FOUET", j - sortieA);
  if (i < 0 || i > sortieA + 12) return null;
  const x = 0.08 * W;
  const l = 0.84 * W;
  const y = 0.05 * H;
  const h = 0.34 * H;
  const enteteH = 0.052 * H;
  const rayon = 0.04 * W;
  const entree = (j: number) => ressort("VERRE", j);
  const rot = (j: number) => ressort("PIVOT", j);
  const pe = entree(i);
  const ps = sortie(i);
  const dyEntree = lerp(-0.4 * H, 0, pe);
  const dySortie = -0.5 * H * ps;
  const rx = lerp(-22, 0, rot(i)) + 15 * ps;
  const rz = lerp(-4, -1.2, rot(i));
  const mv = microVie(i, H);
  const calme = i > 14 && ps === 0;
  const vit = Math.max(vitesse((j) => lerp(0, 0.4 * H, entree(j)), i), vitesse((j) => 0.5 * H * sortie(j), i));
  const sy = Math.min(0.02 * W, vit * 0.22);
  const mise = 0.006 * W * (1 - courbe(i, 0, 4));
  const nbLignes = lignes.length;
  const corpsH = h - enteteH;
  const marge = corpsH * 0.05;
  const gap = corpsH * 0.03;
  const ligneH = (corpsH - 2 * marge - gap * (nbLignes - 1)) / nbLignes;
  const taille = Math.min(ligneH * 0.5, 0.056 * W);
  const rondL = ligneH * 0.56;
  return (
    <Flou sy={sy} mise={mise}>
      <Perspective W={W}>
        <div
          style={{
            position: "absolute",
            left: x,
            top: y,
            width: l,
            height: h,
            transform: `translateY(${dyEntree + dySortie + (calme ? mv.dy : 0)}px) rotateX(${rx + (calme ? mv.rx : 0)}deg) rotateZ(${rz}deg)`,
            transformOrigin: "50% 100%",
            ...styleVerre(W, rayon),
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ height: enteteH, flexShrink: 0, ...styleOrange(W, 0), display: "flex", alignItems: "center", padding: `0 ${enteteH * 0.34}px`, gap: enteteH * 0.22 }}>
            <Icone nom={iconeTitre} taille={enteteH * 0.5} couleur={NUANCES.ivoire} epaisseur={2.6} />
            <span style={{ ...titre(enteteH * 0.5, NUANCES.ivoire), flex: 1, whiteSpace: "nowrap" }}>{titreCarte}</span>
            <div style={{ ...styleVerreEncre(W, enteteH * 0.5), height: enteteH * 0.6, padding: `0 ${enteteH * 0.26}px`, display: "flex", alignItems: "center", gap: enteteH * 0.16 }}>
              {lignes.map((r, k) => (
                <div key={k} style={{ width: enteteH * 0.2, height: enteteH * 0.2, borderRadius: "50%", background: i >= r.a ? NUANCES.orangeChaud : alpha(NUANCES.ivoire, 0.32), transform: `scale(${i >= r.a ? 0.9 + 0.5 * Math.max(0, 1 - (i - r.a) / 5) : 1})` }} />
              ))}
            </div>
          </div>
          <div style={{ flex: 1, padding: `${marge}px ${marge}px`, display: "flex", flexDirection: "column", gap }}>
            {lignes.map((r, k) => {
              const k0 = i - r.a;
              const actif = k0 >= 0;
              const forceHalo = k0 < 0 ? 0 : k0 < 12 ? 1 : Math.max(0, 1 - (k0 - 12) / 8);
              const reveal = courbe(i, r.a + 3, 6);
              const pop = ressort("JAILLIR", k0);
              const entreeLigne = borne01(k0 / 3);
              const l2 = ligneH;
              return (
                <div
                  key={k}
                  style={{
                    position: "relative",
                    height: l2,
                    borderRadius: l2 * 0.3,
                    display: "flex",
                    alignItems: "center",
                    padding: `0 ${l2 * 0.22}px`,
                    gap: l2 * 0.28,
                    opacity: entreeLigne,
                    transform: `translateY(${(1 - entreeLigne) * l2 * 0.25}px)`,
                    background: forceHalo > 0 ? `linear-gradient(90deg, ${alpha(NUANCES.orangeVoile, 0.85 * forceHalo + 0.1)} 0%, ${alpha(NUANCES.ivoire, 1)} 60%)` : alpha(NUANCES.sable, 0.2),
                    boxShadow: forceHalo > 0 ? halo(W, forceHalo) : `inset 0 1px 0 ${alpha(NUANCES.ivoire, 0.6)}`,
                  }}
                >
                  <div style={{ width: rondL, height: rondL, flexShrink: 0, position: "relative" }}>
                    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `${Math.max(3, W * 0.0035)}px solid ${alpha(NUANCES.sableProfond, 0.45)}`, boxSizing: "border-box", opacity: 1 - borne01(pop) }} />
                    {actif ? (
                      <div style={{ position: "absolute", inset: 0, ...styleOrange(W, rondL / 2, 0.6), transform: `scale(${0.4 + 0.6 * pop})`, opacity: borne01(k0 / 2), display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icone nom="coche" taille={rondL * 0.58} couleur={NUANCES.ivoire} epaisseur={3.4} />
                      </div>
                    ) : null}
                  </div>
                  <div style={{ position: "relative", flex: 1, height: l2, display: "flex", alignItems: "center" }}>
                    {actif && k0 < 6 ? (
                      <div style={{ position: "absolute", left: 0, opacity: 1 - borne01((k0 - 2) / 4) }}>
                        <Squelette i={i} i0={r.a} largeur={Math.min(l * 0.6, taille * r.texte.length * 0.56)} hauteur={taille * 0.55} W={W} />
                      </div>
                    ) : null}
                    {actif ? <span style={{ ...texte(taille, NUANCES.encre), whiteSpace: "nowrap", clipPath: `inset(-10% ${(1 - reveal) * 100}% -10% 0)`, transform: `translateX(${(1 - reveal) * -taille * 0.4}px)` }}>{r.texte}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
          <ReflePassant i={i} i0={12} W={l} n={10} hauteur={h} force={0.55} />
          <ReflePassant i={i} i0={46} W={l} n={10} hauteur={h} force={0.45} />
        </div>
      </Perspective>
    </Flou>
  );
}
