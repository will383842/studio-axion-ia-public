/** @jsxRuntime automatic */
/** @jsxImportSource react */
/**
 * PLANCHE D'ATTENTE (C11-T12-PLANCHE-v19c) : les accents par rôle (marque, chiffre, validation) sur fond clair et
 * sombre, avec le contraste mesuré, pour la décision DV-14. Pur (aucun hook, aucune horloge, aucun hasard). Imports
 * relatifs seulement. Rien n'est branché : aucun fichier de la vidéo n'importe celui-ci.
 */
import type { JSX } from "react";
import { rapportContraste } from "../../src/briques/habillage/contraste";
import { couleursSur, FAMILLE_CSS_AXION } from "../../src/briques/jetons-motion";
import { accentPourRole, type RoleAccent } from "../../src/briques/sous-titres/accents-role";

/** Une phrase par rôle ; `accent` est l'indice du mot coloré. */
export const PHRASES_ROLE: Record<RoleAccent, { mots: string[]; accent: number }> = {
  marque: { mots: ["Avec", "Axion", "tout", "va", "vite"], accent: 1 },
  chiffre: { mots: ["Ton", "essai", "dure", "30", "jours"], accent: 3 },
  validation: { mots: ["Ton", "contrat", "est", "validé"], accent: 3 },
};

export const FONDS_PLANCHE = [
  { nom: "clair", page: "ivoire" },
  { nom: "sombre", page: "noir" },
] as const;

const ROLES: RoleAccent[] = ["marque", "chiffre", "validation"];
const SEUIL = 4.5;

export function PlancheAccentsRole(): JSX.Element {
  return (
    <div style={{ fontFamily: FAMILLE_CSS_AXION, padding: 16 }}>
      <h1 style={{ fontSize: 22 }}>{"Proposition DV-14, à valider avant allumage : rien n'est branché"}</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {ROLES.map((role) =>
          FONDS_PLANCHE.map((f) => {
            const pal = couleursSur(f.page);
            const accent = accentPourRole(role, f.nom)!;
            const rapport = rapportContraste(accent.texte, accent.fond);
            const { mots, accent: indice } = PHRASES_ROLE[role];
            return (
              <div key={`${role}-${f.nom}`} data-role={role} data-fond={f.nom} style={{ background: pal.fond, color: pal.texte, padding: 16 }}>
                <div style={{ fontSize: 14 }}>{`${role} · fond ${f.nom}`}</div>
                <p style={{ fontSize: 34, fontWeight: 700, margin: "8px 0" }}>
                  {mots.map((m, i) =>
                    i === indice ? (
                      <span key={i} data-accent="1" style={{ background: accent.fond, color: accent.texte, padding: "0 6px" }}>
                        {m}
                      </span>
                    ) : (
                      <span key={i}>{m}</span>
                    ),
                  )}
                </p>
                <div style={{ fontSize: 16 }}>{`contraste ${rapport.toFixed(2).replace(".", ",")}`}</div>
                {rapport < SEUIL ? (
                  <div data-reserve="1" style={{ fontSize: 16, fontWeight: 700 }}>
                    {"sous 4,5"}
                  </div>
                ) : null}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
