/**
 * Parcours PE « Bento continu » (4 pages, maquette id « e ») : une grille de tuiles illustrées sur quatre pages ; deux tuiles chevauchent
 * une couture (leur texte reste d'un seul côté, à plus de 80 px de la couture). La dernière tuile, sombre, ferme avec l'appel.
 */
import { CHARTE_CONTINU as C, DEGRADES_CONTINU as D } from "../../../../../src/briques/visuels/charte-carrousel";
import { Icone, police, Pose, POLICE_SERIF, Tuile, type VarianteTuile } from "../commun/Primitives";
import type { NomIconeContinu } from "../commun/icones-continu";
import type { VarianteCarte } from "../commun/Primitives";
import type { ProprietesParcours } from "../types";
import { Aparte, bf, Cheval, CarteAbs, champ, Petit, TitreP, typo } from "./commun-parcours";

interface Tuilette {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  variante: VarianteCarte;
  icone: NomIconeContinu;
  titre: string;
  sous?: string;
  /** Largeur du bloc de texte. */
  texte: number;
  couleur: VarianteTuile;
  corps?: number;
  aCheval?: boolean;
}

/** `tl()` : tuile de la grille, icône en haut à gauche, texte ancré en bas à gauche. */
function Tuilette({ x, y, largeur, hauteur, variante, icone, titre, sous, texte, couleur, corps = 46, aCheval = false }: Tuilette) {
  const carte = (
    <CarteAbs x={aCheval ? 0 : x} y={aCheval ? 0 : y} largeur={largeur} hauteur={hauteur} variante={variante} style={{ padding: 34, borderRadius: 46 }}>
      <div style={{ position: "absolute", left: 34, top: 34 }}>
        <Tuile icone={icone} taille={112} variante={couleur} />
      </div>
      <div style={{ position: "absolute", left: 34, bottom: 34, width: texte }}>
        <b style={{ ...bf(corps), display: "block" }}>{typo(titre)}</b>
        {sous ? (
          <Petit taille={28} style={{ marginTop: 8 }}>
            {typo(sous)}
          </Petit>
        ) : null}
      </div>
    </CarteAbs>
  );
  return aCheval ? (
    <Cheval x={x} y={y} style={{ width: largeur, height: hauteur }}>
      {carte}
    </Cheval>
  ) : (
    carte
  );
}

export function PE({ pages }: ProprietesParcours) {
  const [p1, p2, p3, p4] = pages;
  return (
    <>
      <TitreP x={80} y={200} taille={112} largeur={920} titre={champ(p1, "titre")} accent={champ(p1, "accent")} />
      <Tuilette x={80} y={560} largeur={540} hauteur={640} variante="o" icone="mail" titre={champ(p1, "tuile")} texte={420} couleur="k" />
      <Tuilette x={660} y={560} largeur={880} hauteur={350} variante="" icone="doc" titre={champ(p2, "doc")} sous={champ(p2, "docSous")} texte={300} couleur="o" corps={42} aCheval />
      <Pose x={1150} y={610}>
        <div style={{ width: 330, height: 230, borderRadius: 28, background: C.creme2, padding: 26, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 16 }}>
          {[[0.8, C.sableSombre], [0.96, C.lin], [0.6, C.lin], [0.84, C.orange]].map(([l, c]) => (
            <b key={String(l)} style={{ height: 16, width: `${Number(l) * 100}%`, borderRadius: 8, background: String(c), display: "block" }} />
          ))}
        </div>
      </Pose>
      <Tuilette x={660} y={950} largeur={340} hauteur={250} variante="pl" icone="hourglass" titre={champ(p2, "temps")} texte={280} couleur="k" />
      <Tuilette x={1120} y={950} largeur={420} hauteur={250} variante="k" icone="shield" titre={champ(p2, "validez")} texte={340} couleur="o" />
      <Tuilette x={1580} y={560} largeur={880} hauteur={640} variante="" icone="chart" titre={champ(p2, "vue")} sous={champ(p2, "vueSous")} texte={400} couleur="o" aCheval />
      <Pose x={2180} y={640}>
        <div style={{ width: 240, display: "flex", gap: 16, alignItems: "flex-end", height: 420 }}>
          {[[44, `linear-gradient(180deg, ${C.brun}, ${C.encre})`], [68, `linear-gradient(180deg, ${C.brun}, ${C.encre})`], [100, `linear-gradient(180deg, ${C.orangeLumiere}, ${C.orange})`]].map(([h, fond]) => (
            <b key={String(h)} style={{ flex: 1, height: `${h}%`, borderRadius: "18px 18px 0 0", background: String(fond), display: "block" }} />
          ))}
        </div>
      </Pose>
      <Tuilette x={2500} y={560} largeur={500} hauteur={350} variante="pl" icone="users" titre={champ(p3, "equipe")} texte={420} couleur="k" />
      <Tuilette x={2500} y={950} largeur={500} hauteur={250} variante="c" icone="gear" titre={champ(p3, "outils")} texte={420} couleur="w" />
      <Aparte x={1180} y={230} largeur={820} taille={80}>
        {typo(champ(p2, "aparte"))}
      </Aparte>
      <Aparte x={2260} y={230} largeur={900} taille={80}>
        {typo(champ(p3, "aparte"))}
      </Aparte>
      <CarteAbs x={3320} y={560} largeur={840} hauteur={640} variante="k">
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
          <Tuile icone="spark" taille={120} variante="o" />
          <div>
            <b style={{ ...bf(66), display: "block" }}>
              {typo(champ(p4, "titre"))}{" "}
              <em style={{ ...police(400, 73, 0.9, POLICE_SERIF, true), color: C.orange, letterSpacing: "-0.015em" }}>{champ(p4, "accent")}</em>
            </b>
          </div>
          <span style={{ alignSelf: "flex-start", background: D.bouton, color: C.encre, borderRadius: 999, padding: "22px 34px", display: "flex", gap: 14, alignItems: "center" }}>
            <span style={{ ...bf(34, 1) }}>{typo(champ(p4, "bouton"))}</span>
            <Icone nom="send" taille={34} epaisseur={2} />
          </span>
        </div>
      </CarteAbs>
    </>
  );
}
