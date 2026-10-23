/**
 * CALQUES TEXTE de la brique commune « composition » (née au lot M4 ; plan B.7, APRÈS la LUT, fond transparent) :
 *   6 bis incrustations graphiques (montant vert / rouge, objet détouré) · 7 encadré de titre (0-3 s) ·
 *   8 sous-titres (moteur unique du lot M2, `CalqueSousTitres`).
 * Rendu en images PNG transparentes, posées par FFmpeg sur la piste `master-sans-texte` : c'est aussi tout ce que
 * refait le RECALQUE gratuit après la correction d'un mot.
 */
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from "remotion";
import { encadreVisible, incrustationsAuTemps, type ProprietesTexteComposition } from "../../../src/briques/composition/scene";
import { CalqueSousTitres } from "../sous-titres";
import { chargerPoliceTitre, FAMILLE_TITRE } from "./polices";

export function TexteCompose(p: ProprietesTexteComposition) {
  chargerPoliceTitre();
  const image = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Lot M4b : une image par état différent du texte (instants donnés), FFmpeg les répète ensuite.
  const t = p.instants ? (p.instants[image] ?? p.instants.at(-1) ?? 0) : image / fps;
  const k = p.largeur / 1080;
  const e = p.encadre;
  return (
    <AbsoluteFill>
      {incrustationsAuTemps(p.incrustations, t).map((inc, i) =>
        inc.type === "montant" ? (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: inc.centreYPx,
              transform: "translateY(-50%)",
              textAlign: "center",
              fontFamily: `"${FAMILLE_TITRE}"`,
              fontWeight: 700,
              fontSize: inc.taillePx,
              lineHeight: 1,
              color: inc.couleur,
              fontVariantNumeric: "lining-nums tabular-nums",
              WebkitTextStroke: `${10 * k}px #0B0B0B`,
              paintOrder: "stroke fill",
              strokeLinejoin: "round",
              textShadow: `0 ${8 * k}px ${22 * k}px rgba(0,0,0,0.55)`,
              whiteSpace: "nowrap",
            }}
          >
            {inc.texte}
          </div>
        ) : inc.url ? (
          <Img key={i} src={inc.url} style={{ position: "absolute", left: inc.centreXPx - inc.taillePx / 2, top: inc.centreYPx, width: inc.taillePx, transform: "translateY(-50%)", filter: `drop-shadow(0 ${10 * k}px ${18 * k}px rgba(0,0,0,0.55))` }} />
        ) : null,
      )}
      {e && encadreVisible(e, t) && (
        <div style={{ position: "absolute", left: 0, right: 0, top: e.centreYPx, transform: "translateY(-50%)", display: "flex", justifyContent: "center" }}>
          <div
            style={{
              background: "#FFFFFF",
              color: "#0B0B0B",
              borderRadius: e.rayonPx,
              padding: `${e.margeYPx}px ${e.margeXPx}px`,
              fontFamily: `"${FAMILLE_TITRE}"`,
              fontWeight: 700,
              fontSize: e.taillePx,
              lineHeight: 1.18,
              textAlign: "center",
              boxShadow: `0 ${6 * k}px ${24 * k}px rgba(0,0,0,0.28)`,
            }}
          >
            {e.lignes.map((l, i) => (
              <div key={i} style={{ whiteSpace: "nowrap" }}>
                {l}
              </div>
            ))}
          </div>
        </div>
      )}
      {p.sousTitres && <CalqueSousTitres donnees={p.sousTitres} instantSec={t} />}
    </AbsoluteFill>
  );
}
