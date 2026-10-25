/** C05 Fenêtre d'application : titre à accent et une fenêtre d'application illustrée (maquette `heroDash`), avec sa pastille « envoyée ». */
import { useId } from "react";
import { alpha, CHARTE_CONTINU as C } from "../../../../../../src/briques/visuels/charte-carrousel";
import { Carte, Etincelle, Libelle, Pastille, police, Pose, POLICE_TEXTE, Tuile } from "../../commun/Primitives";
import type { ProprietesPlaquette } from "../../types";
import { Cadre, TitreCouverture, ZoneTexte } from "./commun";

const COURBE = "M0 150 C 60 140 90 130 140 110 S 220 70 280 50 S 340 20 400 10";

function Activite() {
  const id = `a${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <div style={{ flex: 1, borderRadius: 34, background: C.creme2, padding: "26px 26px 0", position: "relative", overflow: "hidden", minHeight: 0 }}>
      <Libelle style={{ opacity: 0.55 }}>Activité</Libelle>
      <svg data-decor="" viewBox="0 0 400 170" style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: "70%" }} preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={C.orange} stopOpacity={0.34} />
            <stop offset="1" stopColor={C.orange} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={`${COURBE} L400 170 L0 170Z`} fill={`url(#${id})`} />
        <path d={COURBE} fill="none" stroke={C.orange} strokeWidth={6} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function Fenetre({ largeur, hauteur, page }: { largeur: number; hauteur: number; page: ProprietesPlaquette["page"] }) {
  const etats = page.etats as string[];
  const lignes = page.lignes as { sujet: string; detail: string }[];
  const pastille = { fontSize: 26, padding: "12px 20px 12px 14px" };
  return (
    <Carte style={{ width: largeur, height: hauteur, padding: 0, borderRadius: 52, overflow: "hidden", display: "flex" }}>
      <div style={{ width: 132, background: C.creme2, padding: "34px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
        <Tuile icone="spark" taille={72} variante="o" />
        <Tuile icone="mail" taille={72} variante="w" />
        <Tuile icone="calendar" taille={72} variante="w" />
        <Tuile icone="chart" taille={72} variante="w" />
      </div>
      <div style={{ flex: 1, padding: 34, display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Pastille style={pastille}>
            <Tuile icone="clock" taille={44} variante="p" />
            {etats[0]}
          </Pastille>
          <Pastille style={pastille}>
            <Tuile icone="check" taille={44} variante="o" />
            {etats[1]}
          </Pastille>
        </div>
        <Activite />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {lignes.map((l, i) => (
            <div key={l.sujet} style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <Tuile icone={i === 0 ? "mail" : "doc"} taille={58} variante="o" />
              <b style={{ ...police(600, 28, 1.2, POLICE_TEXTE), flex: 1 }}>{l.sujet}</b>
              <span style={{ ...police(500, 26, 1.2, POLICE_TEXTE), opacity: 0.6 }}>{l.detail}</span>
            </div>
          ))}
        </div>
      </div>
    </Carte>
  );
}

export function C05({ page, hauteur }: ProprietesPlaquette) {
  return (
    <Cadre hauteur={hauteur}>
      <Pose x={80} y={560}>
        <Fenetre largeur={920} hauteur={620} page={page} />
      </Pose>
      <Pose x={610} y={900} rotation={3}>
        <Pastille style={{ fontSize: 30 }}>
          <Tuile icone="send" taille={64} variante="o" />
          {String(page.badge)}
        </Pastille>
      </Pose>
      <Pose x={900} y={470}>
        <Etincelle taille={44} />
      </Pose>
      <ZoneTexte>
        <TitreCouverture taille={120} titre={String(page.titre)} accent={String(page.accent)} suite={page.suite ? String(page.suite) : undefined} style={{ maxWidth: 900 }} />
      </ZoneTexte>
    </Cadre>
  );
}
