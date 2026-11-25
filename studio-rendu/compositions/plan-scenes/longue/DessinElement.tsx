/** Dessine UN élément posé par la mise en page : tout est lu dans l'élément (rectangle, opacité, tracé), rien n'est recalculé. */
import type { CSSProperties } from "react";
import { COULEURS_LONGUE, type ElementPose } from "../../../../src/moteurs/montage-video-longue/storyboard-types";
import { Forme } from "./Formes";
import { FAMILLE_LONGUE } from "./police";

const NUMERIQUE = /^[\d\s.,%+\-−/]+$/;

export function DessinElement({ el, tMs }: { el: ElementPose; tMs: number }) {
  const c = (k?: keyof typeof COULEURS_LONGUE) => (k ? COULEURS_LONGUE[k] : "transparent");
  const base: CSSProperties = { position: "absolute", left: el.rect.x, top: el.rect.y, width: el.rect.largeur, height: el.rect.hauteur, opacity: el.opacite, boxSizing: "border-box" };
  if (el.nature === "texte") {
    const taille = el.taillePx ?? 48;
    const interligne = el.interligne ?? 1.15;
    const chiffres = (el.lignes ?? []).every((l) => l.every((m) => NUMERIQUE.test(m.texte)));
    return (
      <div
        data-id={el.id}
        style={{
          ...base,
          fontFamily: `${FAMILLE_LONGUE}, Manrope, sans-serif`,
          fontSize: taille,
          fontWeight: el.graisse ?? 600,
          lineHeight: `${taille * interligne}px`,
          textAlign: el.alignement === "centre" ? "center" : "left",
          color: c(el.couleur),
          letterSpacing: el.role === "etiquette" ? "0.14em" : undefined,
          fontFeatureSettings: chiffres ? '"tnum"' : undefined,
          whiteSpace: "pre",
        }}
      >
        {(el.lignes ?? []).map((ligne, i) => (
          <div key={i} style={{ height: taille * interligne }}>
            {ligne.map((m, k) => {
              if (!m.accent) return <span key={k}>{m.texte}</span>;
              const couleurAccent = c(el.couleurAccent ?? el.couleur);
              if (el.trace === undefined) return <span key={k} style={{ color: couleurAccent }}>{m.texte}</span>;
              // Mot clé souligné : le trait suit EXACTEMENT la largeur du mot (l'espace qui suit reste hors du soulignement).
              const mot = m.texte.replace(/\s+$/, "");
              const reste = m.texte.slice(mot.length);
              return (
                <span key={k}>
                  <span style={{ color: couleurAccent, opacity: 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(tMs / 190)), backgroundImage: `linear-gradient(${couleurAccent}, ${couleurAccent})`, backgroundRepeat: "no-repeat", backgroundPosition: "0 calc(100% - 6px)", backgroundSize: `${el.trace * 100}% 8px` }}>{mot}</span>
                  {reste}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    );
  }
  if (el.nature === "carte" || el.nature === "volet") {
    return <div data-id={el.id} style={{ ...base, background: c(el.fond), border: el.bordure ? `${el.epaisseurPx ?? 2}px ${el.id.includes(":fili") ? "dashed" : "solid"} ${c(el.bordure)}` : undefined, borderRadius: el.rayonPx ?? 0 }} />;
  }
  if (el.nature === "disque") {
    return <div data-id={el.id} style={{ ...base, borderRadius: "50%", background: c(el.fond), border: el.bordure && (el.epaisseurPx ?? 0) > 0 ? `${el.epaisseurPx}px solid ${c(el.bordure)}` : undefined }} />;
  }
  if (el.nature === "trait") {
    const horizontal = el.rect.largeur >= el.rect.hauteur;
    const t = el.trace ?? 1;
    return (
      <div data-id={el.id} style={{ ...base, opacity: el.opacite }}>
        <div style={{ width: horizontal ? `${t * 100}%` : "100%", height: horizontal ? "100%" : `${t * 100}%`, background: c(el.couleur), borderRadius: Math.min(el.rect.largeur, el.rect.hauteur) / 2 }} />
      </div>
    );
  }
  return (
    <div data-id={el.id} style={base}>
      {el.forme && <Forme forme={el.forme} trace={el.trace ?? 1} couleur={c(el.couleur)} epaisseur={el.epaisseurPx ?? 12} t={tMs / 1000} largeur={el.rect.largeur} />}
    </div>
  );
}
