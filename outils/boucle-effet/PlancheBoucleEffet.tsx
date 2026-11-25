/**
 * PLANCHE « FIN AVEC FONDU / FIN EN BOUCLE » (PLANCHE-BOUCLE-EFFET-v21o, mère X1-18). Outil local : composant pur (aucun hook,
 * aucune horloge, aucun hasard), texte en Manrope. Rien n'importe ce fichier depuis `src/` ni `studio-rendu/`, aucun réglage lu.
 * Scène de STOCK du cas concret : écrans fictifs, texte générique, aucune personne. Le fondu dessiné est celui de l'export
 * (`FIN_PROPRE_COMMUNE` : tenue puis fondu vers la couleur de la dernière carte) ; la boucle montre la décision rendue par
 * `decisionBoucleCasConcret` (dernière image puis directement première image, même fond).
 */
import type { CSSProperties, JSX } from "react";
import type { EcranCale } from "../../src/briques/ecrans-motion";
import { FIN_PROPRE_COMMUNE } from "../../src/briques/composition/fin-propre";
import { CHARTE_AXION, FAMILLE_CSS_AXION } from "../../src/briques/jetons-motion";
import { decisionBoucleCasConcret } from "../../src/moteurs/montage-cas-concret/boucle-effet";

const ecran = (id: string, debutMs: number, finMs: number, ligne: string): EcranCale =>
  ({ id, fond: "ivoire", debutMs, finMs, evenements: [], type: "titre", lignes: [ligne] }) as EcranCale;

/** Écrans calés fictifs d'un cas concret de stock : le premier et le dernier ont le même fond (ivoire). */
export const ECRANS_STOCK: readonly EcranCale[] = [
  ecran("e1", 0, 3000, "Votre devis, en clair"),
  ecran("e2", 3000, 6000, "Trois étapes simples"),
  ecran("e3", 6000, 9000, "Prêt à démarrer"),
];

export type VariantePlanche = "fondu" | "boucle";
export const FORMATS_PLANCHE = { "16x9": { largeur: 1920, hauteur: 1080 }, "9x16": { largeur: 1080, hauteur: 1920 } } as const;
export type FormatPlanche = keyof typeof FORMATS_PLANCHE;

/** Opacité de la couleur de fin posée sur l'image à l'instant `t` (s) après le début de la tenue : 0 pendant la tenue, 1 à la fin du fondu. */
export function opaciteFondFin(t: number): number {
  const { tenueSec, fonduSec } = FIN_PROPRE_COMMUNE;
  return Math.min(1, Math.max(0, (t - tenueSec) / fonduSec));
}

export interface Vignette {
  id: string;
  titre: string;
  /** Écran montré (index dans `ECRANS_STOCK`). */
  ecran: number;
  /** Opacité de la couleur de fin posée dessus. */
  opacite: number;
}

/** Vignettes du fondu (aujourd'hui) : dernière image, image tenue, mi-fondu, fondu fini, première image du tour suivant. */
export function vignettesFondu(): Vignette[] {
  const { tenueSec, fonduSec } = FIN_PROPRE_COMMUNE;
  const dernier = ECRANS_STOCK.length - 1;
  return [
    { id: "derniere", titre: "Dernière image", ecran: dernier, opacite: opaciteFondFin(0) },
    { id: "tenue", titre: `Image tenue (${tenueSec} s)`, ecran: dernier, opacite: opaciteFondFin(tenueSec) },
    { id: "mi-fondu", titre: "Mi-fondu", ecran: dernier, opacite: opaciteFondFin(tenueSec + fonduSec / 2) },
    { id: "fondu-fini", titre: `Fondu fini (${fonduSec} s)`, ecran: dernier, opacite: opaciteFondFin(tenueSec + fonduSec) },
    { id: "tour-suivant", titre: "Première image du tour suivant", ecran: 0, opacite: 0 },
  ];
}

/** Vignettes de la boucle : dernière image puis directement première image, sans fondu. */
export function vignettesBoucle(): Vignette[] {
  return [
    { id: "derniere", titre: "Dernière image", ecran: ECRANS_STOCK.length - 1, opacite: 0 },
    { id: "premiere", titre: "Première image (directement)", ecran: 0, opacite: 0 },
  ];
}

const textesDe = (e: EcranCale): string => (e.type === "titre" ? e.lignes.join(" ") : e.id);

function VueVignette({ v, largeur }: { v: Vignette; largeur: number }): JSX.Element {
  const hauteur = Math.round((largeur * 16) / 9);
  const cadre: CSSProperties = { position: "relative", width: largeur, height: hauteur, background: CHARTE_AXION.ivoire, border: `2px solid ${CHARTE_AXION.noir}`, overflow: "hidden" };
  const texte: CSSProperties = { position: "absolute", left: 0, right: 0, top: "42%", textAlign: "center", fontFamily: FAMILLE_CSS_AXION, fontWeight: 700, fontSize: Math.round(largeur / 9), color: CHARTE_AXION.noir, padding: "0 8%" };
  const voile: CSSProperties = { position: "absolute", inset: 0, background: FIN_PROPRE_COMMUNE.couleur.replace("0x", "#"), opacity: v.opacite };
  return (
    <figure style={{ margin: 0 }} data-vignette={v.id} data-opacite={v.opacite.toFixed(2)}>
      <div style={cadre}>
        <div style={texte}>{textesDe(ECRANS_STOCK[v.ecran]!)}</div>
        <div style={voile} />
      </div>
      <figcaption style={{ fontFamily: FAMILLE_CSS_AXION, fontSize: 26, color: CHARTE_AXION.noir, marginTop: 12, textAlign: "center" }}>{v.titre}</figcaption>
    </figure>
  );
}

/** La planche : un titre, la bande de vignettes, et sous la bande la décision (boucle) ou la durée du fondu (fondu). */
export function PlancheBoucleEffet({ variante, format = "16x9" }: { variante: VariantePlanche; format?: FormatPlanche }): JSX.Element {
  const { largeur, hauteur } = FORMATS_PLANCHE[format];
  const vignettes = variante === "fondu" ? vignettesFondu() : vignettesBoucle();
  const decision = decisionBoucleCasConcret(ECRANS_STOCK);
  const phrase =
    variante === "boucle"
      ? decision.boucle
        ? `Décision de la boucle : boucle, la dernière scène reprend l'état d'entrée « ${decision.raccord.etatFinal} » (même fond aux deux bouts).`
        : `Décision de la boucle : refus (${decision.raison}).`
      : `Aujourd'hui : image tenue ${FIN_PROPRE_COMMUNE.tenueSec} s, puis fondu de ${FIN_PROPRE_COMMUNE.fonduSec} s vers ${FIN_PROPRE_COMMUNE.couleur.replace("0x", "#")}, puis le tour suivant repart.`;
  const colonne = format === "16x9" ? Math.floor((largeur - 160) / 5) - 20 : Math.floor((hauteur - 400) / 5 / 16) * 9 - 20;
  return (
    <div style={{ width: largeur, height: hauteur, background: CHARTE_AXION.ivoire, fontFamily: FAMILLE_CSS_AXION, color: CHARTE_AXION.noir, boxSizing: "border-box", padding: 60 }} data-planche={variante}>
      <div style={{ fontSize: 52, fontWeight: 800 }}>{variante === "fondu" ? "Fin avec fondu (aujourd'hui)" : "Fin en boucle"}</div>
      <div style={{ display: "flex", flexDirection: format === "16x9" ? "row" : "column", gap: 20, marginTop: 40, justifyContent: "center", alignItems: "flex-start" }}>
        {vignettes.map((v) => (
          <VueVignette key={v.id} v={v} largeur={Math.max(120, colonne)} />
        ))}
      </div>
      <div style={{ fontSize: 30, marginTop: 40 }} data-decision={variante === "boucle" ? (decision.boucle ? "boucle" : decision.raison) : "fondu"}>
        {phrase}
      </div>
    </div>
  );
}
