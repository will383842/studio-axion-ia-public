/**
 * Plaquettes d'ESSAI (jamais en production) : couverture `X00`, contenus `X01`, `X03` à `X06`, appel `X02`. Titre, texte, une tuile en relief.
 * Le bas des deux bords (y ≥ 780) reste libre : les raccords s'y posent sur la couture.
 */
import { CHARTE_CONTINU as C } from "../../../../../../src/briques/visuels/charte-carrousel";
import type { NomIconeContinu } from "../../commun/icones-continu";
import { Carte, Etincelle, Pastille, Pose, separerAccent, Texte, Titre, Tuile, type VarianteTuile } from "../../commun/Primitives";
import { MARGE_SURE } from "../../constantes-continu";
import type { ProprietesPlaquette } from "../../types";

const ICONES: Record<string, [NomIconeContinu, VarianteTuile]> = {
  X01: ["target", "o"],
  X03: ["layers", "k"],
  X04: ["gear", "w"],
  X05: ["chat", "p"],
  X06: ["check", "o"],
};

function Zone({ hauteur, children }: { hauteur: number; children: React.ReactNode }) {
  return <div style={{ position: "absolute", left: MARGE_SURE, top: 196, width: 920, height: hauteur - 196 - 150, display: "flex", flexDirection: "column" }}>{children}</div>;
}

export function X00({ page, hauteur }: ProprietesPlaquette) {
  const { texte, accent } = separerAccent(String(page.titre));
  return (
    <>
      <Zone hauteur={hauteur}>
        <Titre taille={124} texte={texte} accent={accent} />
        <Texte style={{ marginTop: 40, maxWidth: 700 }}>{String(page.texte)}</Texte>
      </Zone>
      <Pose x={330} y={hauteur - 560} rotation={-7}>
        <Tuile icone="bulb" taille={250} variante="o" />
      </Pose>
      <Pose x={640} y={hauteur - 430} rotation={6}>
        <Tuile icone="spark" taille={150} variante="w" />
      </Pose>
      <Pose x={230} y={hauteur - 600}>
        <Etincelle taille={56} />
      </Pose>
      <Pose x={760} y={hauteur - 540}>
        <Etincelle taille={34} couleur={C.encre} />
      </Pose>
    </>
  );
}

export function X01({ page, hauteur }: ProprietesPlaquette) {
  const [icone, variante] = ICONES[String(page.type)] ?? ICONES.X01;
  const { texte, accent } = separerAccent(String(page.titre));
  return (
    <>
      <Zone hauteur={hauteur}>
        <Titre taille={96} texte={texte} accent={accent} />
        <Carte style={{ marginTop: 56, display: "flex", gap: 30, alignItems: "center", padding: "34px 40px" }}>
          <Tuile icone={icone} taille={120} variante={variante} />
          <Texte taille={34} style={{ color: C.encre }}>{String(page.texte)}</Texte>
        </Carte>
      </Zone>
      <Pose x={390} y={hauteur - 470} rotation={-5}>
        <Tuile icone={icone} taille={200} variante={variante === "o" ? "k" : "o"} />
      </Pose>
      <Pose x={660} y={hauteur - 400}>
        <Etincelle taille={44} />
      </Pose>
    </>
  );
}

export function X02({ page, hauteur }: ProprietesPlaquette) {
  const { texte, accent } = separerAccent(String(page.titre));
  return (
    <>
      <Zone hauteur={hauteur}>
        <Titre taille={124} texte={texte} accent={accent} />
        <Texte style={{ marginTop: 40, maxWidth: 720 }}>{String(page.texte)}</Texte>
        <div style={{ marginTop: 44 }}>
          <Pastille>
            <Tuile icone="bookmark" taille={56} variante="o" />
            Enregistrez ce carrousel
          </Pastille>
        </div>
      </Zone>
      <Pose x={340} y={hauteur - 480} rotation={-8}>
        <Tuile icone="bookmark" taille={220} variante="k" />
      </Pose>
      <Pose x={600} y={hauteur - 400} rotation={7}>
        <Tuile icone="send" taille={160} variante="w" />
      </Pose>
    </>
  );
}
