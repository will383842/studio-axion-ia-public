/**
 * Étiquettes du lot B : compteur qui défile (référence : l'étiquette apparaît minuscule puis grossit pendant que le
 * nombre défile, ralenti en fin, ≈ 1,5 s) et rangée de logos qui arrivent un à un (fin de carte « calendrier », fin de
 * vidéo). Tout dérive de `t` (secondes).
 */
import React from "react";
import { interpolate, Easing } from "remotion";
import { COULEURS, POLICES, TEMPS } from "./charte";
import { Icone, styleBoite } from "./elements";
import { progression, rebond } from "./mouvement";

export type EtiquetteCompteurProps = {
  t: number;
  debut: number;
  fin: number;
  /** Centre, en pixels. */
  x: number;
  y: number;
  largeurImage: number;
  /** Valeur de départ et d'arrivée (le nombre roule de l'une à l'autre, ralenti en fin). */
  de: number;
  a: number;
  /** Durée du défilement (secondes). */
  dureeDefilement?: number;
  prefixe?: string;
  suffixe?: string;
  legende?: string;
  taille: number;
  fond?: "ivoire" | "orange" | "encre";
};

/** Instants des « tic » du compteur (un par valeur affichée qui change), pour les bruitages. */
export function ticsCompteur(debut: number, de: number, a: number, dureeDefilement = 1.5, max = 14): number[] {
  const pas = Math.min(max, Math.abs(a - de));
  const tics: number[] = [];
  for (let i = 1; i <= pas; i++) {
    // Inverse de la courbe « ralentie en fin » : les tics se resserrent au début et s'espacent à la fin.
    const p = i / pas;
    tics.push(debut + dureeDefilement * (1 - Math.pow(1 - p, 1 / 3)));
  }
  return tics;
}

export function EtiquetteCompteur(p: EtiquetteCompteurProps) {
  if (p.t < p.debut || p.t >= p.fin) return null;
  const duree = p.dureeDefilement ?? 1.5;
  const valeur = Math.round(interpolate(p.t, [p.debut, p.debut + duree], [p.de, p.a], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }));
  // Grossit pendant le défilement (de minuscule à sa taille), puis un dernier petit choc quand le nombre s'arrête.
  // Revue passe 3 (priorité 2, entrées plus amples) : départ à 35 % (gros changement dès la 1ʳᵉ image) au lieu de 15 %.
  const croissance = 0.35 + 0.65 * rebond(p.t, p.debut, TEMPS.pop * 1.8, 1.6);
  const choc = p.t >= p.debut + duree ? 1 + 0.08 * (1 - rebond(p.t, p.debut + duree, 0.16, 3)) : 1;
  // Sortie FRANCHE : disparaît d'un coup à `fin` (un gros mouvement mesurable, pas un fondu sur 3 images).
  const s: number = 0;
  const fond = p.fond === "orange" ? COULEURS.orange : p.fond === "encre" ? COULEURS.encre : COULEURS.ivoire;
  const texte = p.fond === "ivoire" || !p.fond ? COULEURS.encre : COULEURS.ivoire;
  return (
    <div
      style={{
        position: "absolute",
        left: p.x,
        top: p.y,
        transform: `translate(-50%, -50%) rotate(${-TEMPS.inclinaison}deg) scale(${croissance * choc - 0.35 * s})`,
        opacity: 1 - s,
        ...styleBoite(p.largeurImage, fond, Math.round(p.taille * 0.3)),
        padding: `${p.taille * 0.18}px ${p.taille * 0.4}px`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        lineHeight: 1,
      }}
    >
      <span style={{ fontFamily: POLICES.titre, fontSize: p.taille, color: texte, fontVariantNumeric: "tabular-nums" }}>
        {p.prefixe ?? ""}
        {valeur.toLocaleString("fr-FR")}
        {p.suffixe ?? ""}
      </span>
      {p.legende ? <span style={{ fontFamily: POLICES.titre, fontSize: p.taille * 0.34, color: p.fond === "orange" ? COULEURS.ivoire : COULEURS.orange, textTransform: "uppercase", marginTop: p.taille * 0.08 }}>{p.legende}</span> : null}
    </div>
  );
}

export type RangeeLogosProps = {
  t: number;
  debut: number;
  fin: number;
  /** Centre de la rangée, en pixels. */
  x: number;
  y: number;
  largeurImage: number;
  /** Une tuile par icône, chacune à son instant (sur son mot). */
  logos: { icone: string; a: number }[];
  cote?: number;
};

/** Rangée de tuiles : chacune tombe de quelques pixels en grossissant, avec rebond et inclinaison alternée. */
export function RangeeLogos(p: RangeeLogosProps) {
  if (p.t < p.debut || p.t >= p.fin) return null;
  const cote = p.cote ?? Math.round(p.largeurImage * 0.11);
  const s: number = 0;
  return (
    <div style={{ position: "absolute", left: p.x, top: p.y, transform: "translate(-50%, -50%)", display: "flex", gap: cote * 0.22, opacity: 1 - s }}>
      {p.logos.map((l, i) => {
        if (p.t < l.a) return <div key={`${l.icone}-${i}`} style={{ width: cote, height: cote }} />;
        const e = rebond(p.t, l.a, TEMPS.pop, 2.6);
        const chute = (1 - progression(p.t, l.a, TEMPS.pop)) * -cote * 0.6;
        return (
          <div
            key={`${l.icone}-${i}`}
            style={{
              width: cote,
              height: cote,
              ...styleBoite(p.largeurImage, i % 2 ? COULEURS.ivoire : COULEURS.orange),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `translateY(${chute}px) scale(${e}) rotate(${i % 2 ? 4 : -4}deg)`,
            }}
          >
            <Icone nom={l.icone} taille={cote * 0.56} couleur={i % 2 ? COULEURS.orange : COULEURS.ivoire} />
          </div>
        );
      })}
    </div>
  );
}
