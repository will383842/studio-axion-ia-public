import React from "react";
/**
 * Élément 12 `CarteStatuts` (lot 2) : l'équipe au travail. 3-4 lignes « pictogramme + rôle + action » déjà présentes en GRIS ; chaque rôle dit →
 * sa ligne s'allume (recoloration 3 i + fond ACCENT_1 12 i) et sa puce passe « EN COURS » (avec une barre qui avance) ; au rôle suivant, la
 * précédente passe « FAIT » (ACCENT_1 + coche). `decl[k]` = image locale du mot qui cite le rôle k ; la dernière ligne est « FAIT » à `fin`.
 */
import { useCurrentFrame } from "remotion";
import { accents, Case, CoqueCarte, COULEURS, courbe, Ico, melange, PastilleEntete, PastilleRonde, pulsation, ressort, Sons, styleInter, styleMontserrat, TRAIT, vieEntre } from "./commun-lot2";
import type { NomIcone, Palette } from "./commun-lot2";

const { ENCRE, BLANC, GRIS, IVOIRE_CLAIR } = COULEURS;

/** Sablier qui se retourne (pictogramme « en cours ») : demi-tour toutes les 20 images. */
export function Sablier({ i, taille = 40 }: { i: number; taille?: number }) {
  const tour = Math.floor(i / 20);
  const k = (i % 20) / 6;
  const angle = tour * 180 + (k < 1 ? 180 * (k * k * (3 - 2 * k)) : 180);
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke={ENCRE} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", transform: `rotate(${angle - 180}deg)` }}>
      <path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9" />
      <path d="M9.600 18.500h4.800L12 15.500z" fill={ENCRE} />
    </svg>
  );
}

export type RoleStatut = { agent: string; action: string; icone: NomIcone };
export type PropsCarteStatuts = {
  palette: Palette;
  duree: number;
  decl: number[];
  /** Image locale où le dernier rôle passe « FAIT » (par défaut : décl. du dernier + 18). */
  fin?: number;
  roles?: RoleStatut[];
  /** En-tête (mot DIT) ; absent : « L'ÉQUIPE AU TRAVAIL ». */
  titre?: string;
  /** Pastille d'en-tête ; "" : aucune ; absent : « n AGENTS ». */
  pastille?: string;
  avecSons?: boolean;
  /** « pictos » : sablier (en cours) et coche (fait) à la place des mots « EN COURS » / « FAIT » (non dits) ; défaut « texte ». */
  puces?: "texte" | "pictos";
};
const ROLES: RoleStatut[] = [
  { agent: "AGENT TRI", action: "Trie les demandes", icone: "filtre" },
  { agent: "AGENT RÉDACTION", action: "Écrit le message", icone: "stylo" },
  { agent: "AGENT ENVOI", action: "Envoie au client", icone: "avion" },
];

export function evenementsStatuts(decl: number[], duree: number, fin?: number): number[] {
  const f = fin ?? decl[decl.length - 1] + 18;
  return [0, ...decl, ...decl.map((d) => d + 3), ...decl.slice(1), f, duree - 3, ...decl.map((d) => d + 8)];
}

export function CarteStatuts({ palette, duree, decl, fin, roles = ROLES, avecSons = true, titre = "L'ÉQUIPE AU TRAVAIL", pastille, puces = "texte" }: PropsCarteStatuts) {
  const i = useCurrentFrame();
  const { ACCENT_1 } = accents(palette);
  const n = roles.length;
  const iFin = fin ?? decl[n - 1] + 18;
  const hLigne = Math.min(118, (446 - 40 - (n - 1) * 12) / n);
  const vie = vieEntre(evenementsStatuts(decl, duree, fin), duree);
  const sons: [number, string, number?][] = [[0, "whoosh-in", 0.9]];
  decl.forEach((d) => sons.push([d, "select_001", 0.22]));
  sons.push([iFin, "confirmation_002", 0.16]);
  return (
    <>
      <CoqueCarte palette={palette} titre={titre} i={i} duree={duree} vie={vie} pastille={pastille === "" ? undefined : <PastilleEntete>{pastille ?? `${n} AGENTS`}</PastilleEntete>}>
        <div style={{ position: "absolute", left: 38, right: 38, top: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {roles.map((r, k) => {
            const d = decl[k];
            const suivant = k < n - 1 ? decl[k + 1] : iFin;
            const allume = courbe(i, d, 3);
            const actif = i >= d && i < suivant;
            const fait = i >= suivant;
            const flash = i >= d && i < d + 12;
            const fond = fait ? IVOIRE_CLAIR : flash ? ACCENT_1 : melange(GRIS, BLANC, allume);
            const prog = courbe(i, d + 3, Math.max(4, suivant - d - 3));
            return (
              <div key={k} style={{ position: "relative", boxSizing: "border-box", height: hLigne, display: "flex", alignItems: "center", gap: 20, padding: "0 22px", background: fond, border: `${TRAIT.FIN}px solid ${ENCRE}`, borderRadius: 12, borderLeft: i >= d + 12 ? `8px solid ${ACCENT_1}` : undefined, overflow: "hidden" }}>
                <PastilleRonde taille={72} fond={i >= d ? ACCENT_1 : GRIS} style={{ transform: `scale(${i >= d && i < d + 6 ? 1 + 0.15 * Math.sin((Math.PI * (i - d)) / 6) : actif ? pulsation(i, vie, 0.14) : 1})` }}>
                  <Ico nom={r.icone} taille={40} fond={i >= d ? BLANC : "none"} />
                </PastilleRonde>
                <div style={{ flex: 1 }}>
                  <div style={styleMontserrat(34, { letterSpacing: "0.03em" })}>{r.agent}</div>
                  <div style={styleInter(32, 600, { marginTop: 6 })}>{r.action}</div>
                </div>
                {i >= d && (
                  <div style={{ transform: `scale(${(0.5 + 0.5 * ressort("POP", i - d)) * (fait && k === n - 1 ? pulsation(i, vie, 0.12) : 1)})`, transformOrigin: "100% 50%" }}>
                    {fait ? (
                      <div style={{ boxSizing: "border-box", display: "flex", alignItems: "center", gap: 10, background: ACCENT_1, border: `${TRAIT.MOYEN}px solid ${ENCRE}`, borderRadius: 999, padding: puces === "pictos" ? "8px 14px" : "8px 22px 8px 14px", ...styleMontserrat(30, { letterSpacing: "0.03em" }) }}>
                        <Case i={i} i0={suivant} taille={36} fond={BLANC} />
                        {puces === "pictos" ? null : "FAIT"}
                      </div>
                    ) : (
                      <div style={{ boxSizing: "border-box", background: BLANC, border: `${TRAIT.MOYEN}px solid ${ENCRE}`, borderRadius: 999, padding: "8px 24px", ...styleMontserrat(30, { letterSpacing: "0.03em" }) }}>{puces === "pictos" ? <Sablier i={i} taille={40} /> : "EN COURS"}</div>
                    )}
                  </div>
                )}
                {actif && <div style={{ position: "absolute", left: 0, bottom: 0, height: 16, width: `${(prog * 100).toFixed(1)}%`, background: ENCRE }} />}
              </div>
            );
          })}
        </div>
      </CoqueCarte>
      <Sons actif={avecSons && i < duree} liste={sons} />
    </>
  );
}
