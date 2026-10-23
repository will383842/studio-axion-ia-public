import React from "react";
/**
 * La phrase-choc dans une ouverture reprise en boucle (FIN-C, maquette FIN-C-1 : « Même à 3h du matin. » sous le
 * chiffre) : l'axe promet que « la phrase reste MOT POUR MOT, aux mêmes heures » ; la boucle ne la dessinait pas
 * (relecture finale du 23/10/2026, v-6e4a06b9c718 : « phrase-choc absente de toute la vidéo »). La phrase arrive mot
 * par mot à ses heures (jamais un mot avant son heure), un seul mot orange, disposée comme en FIN-D (`disposerPhrase`).
 * Chaque mot porte `data-mot` (son rang dans la phrase) : un test lit le dessin réel.
 *
 * Les zones (`ZONES_PHRASE`) sont posées HORS de la bande des sous-titres (qui reste affichée pendant FIN-C : 1152 →
 * 1286 px en 9:16, 1042 → 1176 px dans le cadre de l'image en 4:5) et dans la hauteur utile (`CADRES_IV[format].utile` :
 * 230 → 1536 px en 9:16, 54 → 1215 px en 4:5, au-dessus de ce que recouvre l'interface des réseaux) ; un test le vérifie
 * sur cette même table. Hauteur minimale pour la vraie phrase en deux phrases : 162 px (58 px puis 62 px, 1 ligne
 * chacune, sans repli).
 */
import type { FormatIV } from "../../../../../src/briques/schema-motion/variete";
import { a, ANTON, C } from "../objets-ouverture";
import { disposerPhrase } from "../fin/fin-d";

/** Ce que la fin FIN-C transmet à l'ouverture reprise : la phrase-choc du moment (champs de `DonneesFin`). */
export type PhraseBoucle = { phrase: string; mots: string[]; heures: number[]; lignes: number[] };

/** Où se pose la phrase (px de l'écran de référence 1080 × 1920, repère de l'ouverture). */
export type ZonePhrase = {
  x: number;
  y: number;
  largeur: number;
  hauteurMax: number;
  centre: boolean;
  /** Marge (px) de la plaque nuit derrière la phrase ; 0 = pas de plaque. */
  plaque: number;
  /** L'ouverture est dessinée dans le cadre 4:5 réduit (`Ecran cadre45` : échelle 0,98, décalage −86,76 px). */
  cadre45: boolean;
};

const zone = (x: number, y: number, largeur: number, hauteurMax: number, centre: boolean, plaque: number, cadre45: boolean): ZonePhrase => ({ x, y, largeur, hauteurMax, centre, plaque, cadre45 });

/** Clé : `<ouverture>|<format>` ; OUV-C a deux dessins (horloge si elle a une heure, sinon téléphone). */
export const ZONES_PHRASE: Record<string, ZonePhrase> = {
  "OUV-A|9:16": zone(72, 972, 936, 170, false, 0, false),
  "OUV-A|4:5": zone(72, 826, 936, 162, false, 0, false),
  "OUV-B|9:16": zone(72, 1310, 936, 200, true, 22, false),
  // 4:5 : le bas utile est à 1215 px (`CADRES_IV["4:5"].utile.bas`, la barre de lecture recouvre les 135 px du bas) et la
  // bande des sous-titres est à 1042 → 1176 : la phrase se pose AU-DESSUS de la bande (≈ 858 → 1041 px à l'écran). La
  // plaque nuit recouvre alors la bulle et la coche du bas de la moitié ivoire / nuit : choix de dessin à valider par Will
  // (le 4:5 n'est pas activé en production).
  "OUV-B|4:5": zone(72, 976, 936, 162, true, 12, true),
  "OUV-C-horloge|9:16": zone(72, 974, 936, 170, true, 0, false),
  "OUV-C-horloge|4:5": zone(72, 974, 936, 170, true, 0, true),
  "OUV-C-telephone|9:16": zone(72, 930, 936, 190, true, 22, false),
  "OUV-C-telephone|4:5": zone(72, 930, 936, 190, true, 22, true),
  "OUV-D|9:16": zone(72, 330, 936, 790, false, 0, false),
  "OUV-D|4:5": zone(72, 330, 936, 790, false, 0, true),
  "OUV-E|9:16": zone(110, 690, 900, 410, false, 0, false),
  "OUV-E|4:5": zone(110, 690, 840, 410, false, 0, true),
};
export const zonePhrase = (ouverture: string, format: FormatIV): ZonePhrase => ZONES_PHRASE[`${ouverture}|${format}`];

/** Combien de mots sont dits à l'instant `t` (s, depuis le début du bloc) : au moins un, comme en FIN-D. */
export const motsDits = (p: Pick<PhraseBoucle, "heures">, t: number): number => Math.max(1, p.heures.filter((h) => t >= h - 0.02).length);

/** Rang du mot orange (`*mot*` dans la phrase), -1 s'il n'y en a pas. */
export const rangOrange = (phrase: string): number => phrase.split(/\s+/).findIndex((m) => /\*/.test(m));

export function PhraseChoc({ p, t, zone: z, couleur, orange }: { p: PhraseBoucle; t: number; zone: ZonePhrase; couleur: string; orange: string }) {
  const vus = motsDits(p, t);
  const rang = rangOrange(p.phrase);
  const parPhrase = p.lignes.map((n, i) => Math.max(0, Math.min(n, vus - p.lignes.slice(0, i).reduce((s, v) => s + v, 0)))).filter((k) => k > 0);
  const lignes = disposerPhrase({ mots: p.mots.slice(0, vus), lignes: parPhrase }, z.hauteurMax, z.largeur);
  const haut = lignes.reduce((h, l) => h + l.taille * l.interligne + l.marge, 0);
  return (
    <>
      {z.plaque > 0 ? <div style={{ position: "absolute", left: z.x - 28, top: z.y - z.plaque, width: z.largeur + 56, height: z.hauteurMax + 2 * z.plaque, borderRadius: 44, background: a(C.nuit, 0.96) }} /> : null}
      <div data-phrase-choc="1" style={{ position: "absolute", left: z.x, top: z.y + Math.max(0, (z.hauteurMax - haut) / 2), width: z.largeur, ...ANTON, color: couleur, whiteSpace: "nowrap", textAlign: z.centre ? "center" : "left" }}>
        {lignes.map((l, i) => (
          <div key={i} style={{ fontSize: l.taille, lineHeight: l.interligne, marginTop: l.marge }}>
            {l.mots.map((m, j) => (
              <span key={m.k} data-mot={m.k} style={{ color: m.k === rang ? orange : couleur }}>
                {j ? " " : ""}
                {m.texte}
              </span>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
