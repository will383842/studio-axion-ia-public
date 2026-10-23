import { chargerPoliceJetBrainsMono } from "../polices";
import { COULEURS, POLICE_CORPS, TAILLES } from "./constantes";

/** Pastille de texte (encre sur crème) : le texte vient du spec. */
export function Badge({ texte }: { texte: string }) {
  chargerPoliceJetBrainsMono();
  return (
    <div
      style={{
        display: "inline-block",
        alignSelf: "flex-start",
        maxWidth: "100%",
        padding: "14px 30px",
        borderRadius: 999,
        background: COULEURS.encre,
        color: COULEURS.creme,
        fontFamily: POLICE_CORPS,
        fontWeight: 700,
        fontSize: TAILLES.badge,
        lineHeight: 1.25,
      }}
    >
      {texte}
    </div>
  );
}
