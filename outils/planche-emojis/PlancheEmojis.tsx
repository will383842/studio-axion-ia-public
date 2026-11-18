/**
 * PLANCHE DES ÉMOJIS FLUENT (C9-40c) : les émojis plats posés en grille, chacun avec son nom, sur une planche outil local.
 * Pur (aucun hook, aucune horloge, aucun hasard) ; le texte SVG de chaque émoji est fourni par l'appelant (aucune lecture de fichier ici).
 * Imports relatifs seulement. Rien n'est inscrit, rien n'est allumé : aucun générateur n'importe ce fichier.
 */
import type { JSX } from "react";
import { couleursSur, FAMILLE_CSS_AXION, type FondAxion } from "../../src/briques/jetons-motion";
import { EMOJIS_FLUENT } from "../../src/briques/motion/petits-objets/emojis";
import { colonnesPlanche, DIMENSIONS_PLANCHE, type FormatPlanche } from "../../studio-rendu/compositions/petits-objets/planche/PlancheTraits";

export const FORMATS_EMOJIS: readonly FormatPlanche[] = ["9x16", "4x5"];

/** Encodage base64 pur (identique d'un rendu à l'autre, sans Buffer ni btoa). */
function base64(texte: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const octets: number[] = [];
  for (const car of texte) {
    const c = car.codePointAt(0) ?? 0;
    if (c < 0x80) octets.push(c);
    else if (c < 0x800) octets.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) octets.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else octets.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  let sortie = "";
  for (let i = 0; i < octets.length; i += 3) {
    const [a, b, c] = [octets[i], octets[i + 1], octets[i + 2]];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    sortie += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63] + (b === undefined ? "=" : alphabet[(n >> 6) & 63]) + (c === undefined ? "=" : alphabet[n & 63]);
  }
  return sortie;
}

export function PlancheEmojis({ fond, format, svgs }: { fond: FondAxion; format: FormatPlanche; svgs: Readonly<Record<string, string>> }): JSX.Element {
  const { largeur, hauteur } = DIMENSIONS_PLANCHE[format];
  const cols = colonnesPlanche(EMOJIS_FLUENT.length, largeur, hauteur);
  const cote = largeur / cols;
  const pal = couleursSur(fond);
  return (
    <div data-planche={`emojis-${format}-${fond}`} style={{ position: "relative", width: largeur, height: hauteur, background: pal.fond, display: "flex", flexWrap: "wrap", alignContent: "flex-start", overflow: "hidden", fontFamily: FAMILLE_CSS_AXION }}>
      {EMOJIS_FLUENT.map((e) => {
        const svg = svgs[e.id];
        return (
          <div key={e.id} data-emoji={e.id} {...(svg === undefined ? { "data-manque": e.id } : {})} style={{ position: "relative", width: cote, height: cote, boxSizing: "border-box", border: `1px solid ${pal.texteDoux}` }}>
            {svg !== undefined && (
              <img alt="" src={"data:image/svg+xml;base64," + base64(svg)} style={{ position: "absolute", left: "20%", top: "10%", width: "60%", height: "60%", objectFit: "contain" }} />
            )}
            <span style={{ position: "absolute", left: 4, right: 4, bottom: 4, textAlign: "center", fontSize: Math.max(8, cote / 14), color: pal.texte }}>{e.nom}</span>
          </div>
        );
      })}
    </div>
  );
}
