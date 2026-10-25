/** C07 Téléphone : titre à accent, une ligne, un téléphone incliné avec quatre notifications (maquette `heroPhone`), une tuile cloche. */
import { alpha, CHARTE_CONTINU as C } from "../../../../../../src/briques/visuels/charte-carrousel";
import type { NomIconeContinu } from "../../commun/icones-continu";
import { Carte, Etincelle, police, Pose, POLICE_TEXTE, Texte, Tuile, ombre, type VarianteTuile } from "../../commun/Primitives";
import type { ProprietesPlaquette } from "../../types";
import { Cadre, TitreCouverture, ZoneTexte } from "./commun";

const NOTIFICATIONS: [NomIconeContinu, VarianteTuile][] = [
  ["mail", "o"],
  ["calendar", "k"],
  ["doc", "w"],
  ["check", "p"],
];

function Notification({ icone, variante, titre, detail }: { icone: NomIconeContinu; variante: VarianteTuile; titre: string; detail: string }) {
  return (
    <Carte style={{ padding: "20px 22px", borderRadius: 34, display: "flex", gap: 18, alignItems: "center" }}>
      <Tuile icone={icone} taille={76} variante={variante} />
      <div>
        <b style={{ ...police(700, 28, 1.1, POLICE_TEXTE), display: "block" }}>{titre}</b>
        <span style={{ ...police(500, 26, 1.2, POLICE_TEXTE), opacity: 0.65, display: "block", marginTop: 4 }}>{detail}</span>
      </div>
    </Carte>
  );
}

function Telephone({ rotation, notifications }: { rotation: number; notifications: { titre: string; detail: string }[] }) {
  return (
    <div style={{ width: 430, height: 860, borderRadius: 78, background: C.encre, padding: 16, boxShadow: `0 70px 80px -30px ${ombre(0.65)}, inset 0 0 0 3px ${C.brun}`, transform: `rotate(${rotation}deg)` }}>
      <div style={{ width: "100%", height: "100%", borderRadius: 64, background: C.creme, position: "relative", overflow: "hidden", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ width: 130, height: 36, borderRadius: 20, background: C.encre, margin: "0 auto 10px", flex: "none" }} />
        {NOTIFICATIONS.map(([icone, variante], i) => (
          <Notification key={icone} icone={icone} variante={variante} titre={notifications[i].titre} detail={notifications[i].detail} />
        ))}
      </div>
    </div>
  );
}

export function C07({ page, hauteur }: ProprietesPlaquette) {
  return (
    <Cadre hauteur={hauteur}>
      {/* Maquette : téléphone à y = 420, cloche à y = 900. Le téléphone est remonté de 110 px et son écran resserré (au budget plein, la 4e
          notification débordait de l'écran et entrait dans le coin réservé) ; la cloche est descendue de 110 px (elle couvrait la fin du texte). */}
      <Pose x={600} y={310}>
        <Telephone rotation={-6} notifications={page.notifications as { titre: string; detail: string }[]} />
      </Pose>
      <Pose x={60} y={1010}>
        <Tuile icone="bell" taille={150} variante="o" />
      </Pose>
      <Pose x={470} y={980}>
        <Etincelle taille={48} />
      </Pose>
      <ZoneTexte>
        <TitreCouverture taille={138} titre={String(page.titre)} accent={String(page.accent)} style={{ marginTop: 16, maxWidth: 560 }} />
        <Texte style={{ marginTop: 36, maxWidth: 400 }}>{String(page.texte)}</Texte>
      </ZoneTexte>
    </Cadre>
  );
}
