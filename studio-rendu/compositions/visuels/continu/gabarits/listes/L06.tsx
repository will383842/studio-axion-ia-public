/** L06 · Matrice effort / impact : quatre cases, axes posés par le code, le premier point (cible) dans la case orange. */
import { Carte, Libelle, police, POLICE_TEXTE, Titre, Tuile } from "../../commun/Primitives";
import type { ProprietesPlaquette } from "../../types";
import { ZoneListe } from "./commun";

/** Étiquettes fixes : jamais des champs du spec. */
const AXE_IMPACT = "Impact →";
const AXE_FACILITE = "Facilité →";
const CASE_PRIORITE = "Commencez ici";

/** Place de chaque point dans la matrice (x en px depuis la gauche, y en part de la hauteur) : le premier est la cible. */
const PLACES = [
  { x: 530, y: 0.396 },
  { x: 60, y: 0.36 },
  { x: 70, y: 0.767 },
  { x: 520, y: 0.815 },
];

export function L06({ page, hauteur }: ProprietesPlaquette) {
  const points = page.points as { label: string }[];
  return (
    <ZoneListe hauteur={hauteur}>
      <Titre taille={96} texte={String(page.titre)} accent={String(page.accent)} style={{ marginBottom: 34 }} />
      <div style={{ flex: 1, minHeight: 0, position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 16, marginLeft: 60, marginBottom: 46 }}>
        <Carte variante="c" style={{ borderRadius: 40 }}>{null}</Carte>
        <Carte variante="o" style={{ borderRadius: 40 }}>
          <Libelle>{CASE_PRIORITE}</Libelle>
        </Carte>
        <Carte variante="c" style={{ borderRadius: 40 }}>{null}</Carte>
        <Carte variante="c" style={{ borderRadius: 40 }}>{null}</Carte>
        {points.map((p, i) => (
          <div key={i} style={{ position: "absolute", left: PLACES[i].x, top: `${PLACES[i].y * 100}%`, display: "flex", alignItems: "center", gap: 16, transform: "translateY(-50%)" }}>
            <Tuile icone={i === 0 ? "target" : "bulb"} taille={i === 0 ? 96 : 72} variante={i === 0 ? "k" : "w"} />
            <b style={police(700, 31, 1.1, POLICE_TEXTE)}>{p.label}</b>
          </div>
        ))}
        <Libelle style={{ position: "absolute", left: -30, top: "50%", transform: "translate(-50%, -50%) rotate(-90deg)", whiteSpace: "nowrap", opacity: 0.6 }}>{AXE_IMPACT}</Libelle>
        <Libelle style={{ position: "absolute", left: "50%", bottom: -46, transform: "translateX(-50%)", opacity: 0.6 }}>{AXE_FACILITE}</Libelle>
      </div>
    </ZoneListe>
  );
}
