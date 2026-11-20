/** @jsxRuntime automatic */
/** @jsxImportSource react */
/**
 * PLANCHE D'ATTENTE (C11-T3-PLANCHE-v19c) : les 4 marques de la plaque du mot clé (pinceau, papier déchiré,
 * chevauchement, évidé) autour de quelques mots, en terracotta et en ivoire, sur fond ivoire et sur fond noir. Pur
 * (aucun hook, aucune horloge ; formes à graine). Imports relatifs seulement. Rien n'est branché : aucun fichier de la
 * vidéo n'importe celui-ci, et l'interrupteur des marques reste éteint.
 */
import type { JSX } from "react";
import { couleursSur, FAMILLE_CSS_AXION, type FondAxion } from "../../src/briques/jetons-motion";
import { couleursMarque, geometrieMarque, MARQUES_MOT, type GeometrieMarque, type MarqueMot } from "../../src/briques/sous-titres/marques-mot";
import { geometriePave, type BoitePave } from "../../src/briques/sous-titres/pave";
import { largeurMot } from "../../src/briques/sous-titres/mesure";

export const MOTS_MARQUE = ["contrat", "gratuit", "30"];
export const TAILLE_PX = 72;
export const GRAINE = "planche-c11-t3";

const FONDS: readonly FondAxion[] = ["ivoire", "noir"];
const TEINTES = ["terracotta", "ivoire"] as const;
const MARGE_PX = 40;

export function boiteDuMot(mot: string): BoitePave {
  return { xPx: MARGE_PX, yPx: MARGE_PX, largeurPx: largeurMot(mot, "Manrope ExtraBold", TAILLE_PX), hauteurPx: TAILLE_PX };
}

/** Forme de la plaque à l'état final (t = 1 : l'entrée de 0,18 s est finie). */
export function formeDe(marque: MarqueMot, mot: string): GeometrieMarque | null {
  return geometrieMarque(marque, geometriePave(boiteDuMot(mot), TAILLE_PX, 1), TAILLE_PX, `${GRAINE}:${mot}`);
}

function Plaque({ forme, marque, teinte }: { forme: GeometrieMarque; marque: MarqueMot; teinte: (typeof TEINTES)[number] }): JSX.Element {
  const c = couleursMarque(marque, teinte);
  const b = forme.base;
  if (forme.chemin !== undefined) return <path d={forme.chemin} fill={c.fond} />;
  if (forme.decalageYPx !== undefined) {
    return <rect x={b.x} y={b.y + forme.decalageYPx} width={b.largeur} height={b.hauteur} rx={b.rayon} fill={c.fond} />;
  }
  return <rect x={b.x} y={b.y} width={b.largeur} height={b.hauteur} rx={b.rayon} fill="none" stroke={c.fond} strokeWidth={4} />;
}

export function PlancheMarquesMot(): JSX.Element {
  return (
    <div style={{ fontFamily: FAMILLE_CSS_AXION, padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 16px" }}>Planche d&apos;attente C11-T3 : rien n&apos;est branché</h1>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {FONDS.flatMap((fond) =>
          TEINTES.flatMap((teinte) =>
            MARQUES_MOT.flatMap((marque) =>
              MOTS_MARQUE.map((mot) => {
                const forme = formeDe(marque, mot);
                if (forme === null) return null;
                const c = couleursMarque(marque, teinte);
                const boite = boiteDuMot(mot);
                const horsPlaque =
                  marque === "chevauche" && forme.base.y + (forme.decalageYPx ?? 0) + forme.base.hauteur < MARGE_PX + TAILLE_PX;
                return (
                  <figure key={`${fond}-${teinte}-${marque}-${mot}`} style={{ margin: 0, fontSize: 12 }}>
                    <svg
                      data-marque={marque}
                      data-teinte={teinte}
                      data-fond={fond}
                      data-mot={mot}
                      width={boite.largeurPx + 2 * MARGE_PX}
                      height={TAILLE_PX + 2 * MARGE_PX}
                      style={{ background: couleursSur(fond).fond }}
                    >
                      <Plaque forme={forme} marque={marque} teinte={teinte} />
                      <text
                        x={MARGE_PX}
                        y={MARGE_PX}
                        fill={c.texte}
                        fontFamily={FAMILLE_CSS_AXION}
                        fontWeight={800}
                        fontSize={TAILLE_PX}
                        dominantBaseline="hanging"
                      >
                        {mot}
                      </text>
                    </svg>
                    <figcaption>
                      {`${fond} / ${teinte} / ${marque}`}
                      {marque === "chevauche" ? ` ; bas du mot hors plaque : ${horsPlaque ? "oui" : "non"}` : ""}
                    </figcaption>
                  </figure>
                );
              }),
            ),
          ),
        )}
      </div>
    </div>
  );
}
