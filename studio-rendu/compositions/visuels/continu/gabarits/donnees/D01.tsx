/** D01 « Grand chiffre » : anneau rempli de n/m, tuile au centre, « n sur m » en très grand, légende et source du fait validé. */
import { useId } from "react";
import { FAIT_EXEMPLE } from "../../../../../../src/briques/visuels/continu/familles/donnees";
import { CHARTE_CONTINU as C } from "../../../../../../src/briques/visuels/charte-carrousel";
import { Etiquette, police, POLICE_SERIF, POLICE_TEXTE, POLICE_TITRE, Tuile } from "../../commun/Primitives";
import { MARGE_SURE, TAILLES_CONTINU } from "../../constantes-continu";
import type { ProprietesPlaquette } from "../../types";
import { TEXTES_DONNEES } from "./textes-fixes";

export function D01({ page, hauteur }: ProprietesPlaquette) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const n = Number(page.numerateur);
  const m = Number(page.denominateur);
  const part = m > 0 ? Math.min(1, n / m) : 0;
  const circonference = 2 * Math.PI * 150;
  return (
    <div style={{ position: "absolute", left: MARGE_SURE, top: 196, width: 920, height: hauteur - 196 - 150, display: "flex", flexDirection: "column" }}>
      {String(page.faitId) === FAIT_EXEMPLE ? <Etiquette>{TEXTES_DONNEES.d01Etiquette}</Etiquette> : null}
      <div style={{ display: "flex", alignItems: "center", gap: 30, marginTop: 40 }}>
        <div style={{ position: "relative", width: 420, height: 420, flex: "none" }}>
          <svg width={420} height={420} viewBox="0 0 420 420" aria-hidden>
            <defs>
              <linearGradient id={`a${id}`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor={C.orangeClair} />
                <stop offset="1" stopColor={C.orange} />
              </linearGradient>
            </defs>
            <circle cx={210} cy={210} r={150} fill="none" stroke={C.encre} strokeOpacity={0.1} strokeWidth={54} />
            <circle cx={210} cy={210} r={150} fill="none" stroke={`url(#a${id})`} strokeWidth={54} strokeLinecap="round" strokeDasharray={`${circonference * part} ${circonference}`} transform="rotate(-90 210 210)" />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <Tuile icone="users" taille={150} variante="o" />
          </div>
        </div>
        <div style={{ ...police(800, 330, 0.82, POLICE_TITRE), letterSpacing: "-0.07em", whiteSpace: "nowrap" }}>
          {String(page.numerateur)}
          <span style={{ ...police(400, 165, 0.82, POLICE_SERIF, true), letterSpacing: "-0.02em", color: C.orange }}> sur </span>
          {String(page.denominateur)}
        </div>
      </div>
      <div style={{ marginTop: "auto" }}>
        <p style={{ ...police(500, 40, 1.32, POLICE_TEXTE), color: C.grisTexte, margin: 0 }}>{String(page.legende)}</p>
        <p style={{ ...police(500, TAILLES_CONTINU.sm, 1.3, POLICE_TEXTE), color: C.grisTexte, margin: "18px 0 0" }}>
          {TEXTES_DONNEES.d01Source} {String(page.source)}, {String(page.date)}
        </p>
      </div>
    </div>
  );
}
