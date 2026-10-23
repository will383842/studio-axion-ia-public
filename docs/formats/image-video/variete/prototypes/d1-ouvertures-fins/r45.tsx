import React from "react";
/**
 * Versions 4:5 (1080 × 1350, fil LinkedIn / Facebook) : texte entre x = 60 et 1020, y = 54 et 1188 (standard, § 3).
 * Mêmes tailles en pixels qu'en 9:16 (marque 36 px, texte ≥ 58 px, chiffres ≥ 96 px).
 */
import { a, ANTON, C, DixBarres, Ecran, Etiquette, INTER, Lueur, T } from "./objets";
import { PhraseEtChiffre } from "./fins";

function SousTitre45({ texte, fond, y = 1062 }: { texte: string; fond: "sombre" | "ivoire"; y?: number }) {
  const accent = fond === "sombre" ? C.orangeVif : C.orange;
  const mots = texte.split(/\s+/);
  return (
    <div style={{ position: "absolute", left: 60, width: 960, top: y, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
      <div style={{ ...INTER, fontSize: 58, color: fond === "sombre" ? C.ivoire : C.encre, whiteSpace: "nowrap" }}>
        {mots.map((m, i) => (
          <span key={i} style={{ color: /^\*.*\*[.,!?…:]*$/.test(m) ? accent : undefined }}>
            {i ? " " : ""}
            {m.replace(/\*/g, "")}
          </span>
        ))}
      </div>
      <div style={{ width: 620, height: 6, borderRadius: 3, background: accent, opacity: 0.85 }} />
    </div>
  );
}

/** R45 · OUV-A posée : sur ivoire, le chiffre en majesté, la barre 80 / 20 achève de se remplir (aucun claquement). */
export function R45OuvA1() {
  return (
    <Ecran fond="ivoire" hauteur={1350}>
      <Etiquette texte="Situation type · support client" y={190} fond="ivoire" />
      <div style={{ position: "absolute", left: 56, top: 236, display: "flex", alignItems: "flex-start" }}>
        <span style={{ ...ANTON, fontSize: 600, color: C.orange }}>80</span>
        <span style={{ ...ANTON, fontSize: 230, color: C.orange, marginLeft: 14, marginTop: 50 }}>%</span>
      </div>
      <T x={72} y={850} taille={104} couleur={C.encre}>Résolus sans humain</T>
      {/* la barre 80 / 20 : la part orange finit de glisser à sa place */}
      <div style={{ position: "absolute", left: 72, top: 990, width: 936, height: 30, borderRadius: 15, background: C.encre }} />
      <div style={{ position: "absolute", left: 72, top: 990, width: 936 * 0.8 - 6, height: 30, borderRadius: 15, background: C.orange }} />
      <div style={{ position: "absolute", left: 72 + 936 * 0.8 - 40, top: 990, width: 34, height: 30, background: `linear-gradient(90deg, ${a(C.orange, 0)}, ${a(C.ivoire, 0.35)})`, borderRadius: 15 }} />
      <SousTitre45 texte="Pendant votre sommeil." fond="ivoire" y={1072} />
    </Ecran>
  );
}

/** R45 · FIN-D : la phrase-choc, le « 80 % » et ses dix barres au-dessus (jamais derrière) ; pas de témoin de
 * sous-titres (la voix lit la phrase écrite). Bande des sous-titres 1042 → 1176 laissée libre. */
export function R45FinD1() {
  return (
    <Ecran fond="sombre" hauteur={1350}>
      <Lueur x={540} y={560} r={560} o={0.5} />
      <PhraseEtChiffre y0={168} barres />
    </Ecran>
  );
}
