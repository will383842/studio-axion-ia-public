import React from "react";
/**
 * INTERFACES ANIMÉES SOBRES du lot 4 (tour 2) : aucun clip de `communs/broll/` ne montre une boîte de réception, un envoi de devis ou une signature sur écran.
 * Ces écrans sont donc dessinés (aplats, contour encre, capitales Black) : aucun faux avis, aucun faux chiffre, aucun faux nom. Tout est piloté par `f` (images locales).
 */
import { Ancre, COULEURS, MONTSERRAT, TRAIT, accents, borne, lerp, prog, ress, secousse } from "./commun-lot4";
import type { Palette } from "./commun-lot4";

const { ENCRE, IVOIRE_CLAIR, BLANC, GRIS } = COULEURS;

const txt = (corps: number, couleur: string = ENCRE): React.CSSProperties => ({ fontFamily: MONTSERRAT, fontWeight: 900, fontSize: corps, lineHeight: 1, textTransform: "uppercase", letterSpacing: "0.01em", whiteSpace: "nowrap", color: couleur });

/** Coche ronde (disque ACCENT, contour encre) qui CLAQUE à l'image `debut`, diamètre `d`. */
export function Coche({ f, debut, d, fond, style }: { f: number; debut: number; d: number; fond: string; style?: React.CSSProperties }) {
  if (f < debut) return null;
  const e = lerp(0.2, 1, ress("CLAQUE", f, debut));
  return (
    <div style={{ width: d, height: d, borderRadius: 999, background: fond, border: `${TRAIT.MOYEN}px solid ${ENCRE}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `5px 6px 0 0 ${ENCRE}`, transform: `scale(${e.toFixed(3)})`, ...style }}>
      <svg width={d * 0.56} height={d * 0.56} viewBox="0 0 52 52">
        <path d="M9 27 L21 39 L43 13" fill="none" stroke={ENCRE} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset={60 * (1 - prog(f, debut + 1, 4))} />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ Boîte de réception (BandeVideo) ------------------------------------------------------------------ */
const LIGNES_DEMANDES = ["NOUVELLE DEMANDE", "DEMANDE DE DEVIS", "NOUVEAU MESSAGE", "RAPPEL DEMANDÉ", "DEMANDE DE DEVIS", "NOUVELLE DEMANDE"];
const PAS_DEMANDE = 9; // une demande tombe toutes les 9 images

/** Boîte de réception qui se remplit : une ligne tombe en haut toutes les 9 i et pousse les autres vers le bas. Remplit une boîte `l` × `h`. */
export function BoiteReception({ f, l, h, palette }: { f: number; l: number; h: number; palette: Palette }) {
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const hl = 128; // hauteur d'une ligne
  const gap = 14;
  const pas = hl + gap;
  const n = Math.max(0, Math.floor(f / PAS_DEMANDE) + 3);
  const wL = Math.min(l - 80, 1000);
  const x0 = (l - wL) / 2;
  const rows: React.ReactNode[] = [];
  for (let k = Math.max(0, n - 6); k < n; k++) {
    const arrivee = (k - 2) * PAS_DEMANDE;
    const age = f - arrivee; // images depuis l'arrivée
    const rang = n - 1 - k; // 0 = le plus récent
    // le groupe se décale d'un cran vers le bas à chaque arrivée (ressort), la ligne neuve tombe de plus haut
    const glisse = k === n - 1 && arrivee > 0 ? 1 - Math.min(1.1, ress("CHUTE", f, arrivee)) : 0;
    const dec = rang === 0 ? 0 : 1 - Math.min(1.05, ress("GLISSE", f, (n - 3) * PAS_DEMANDE));
    const y = 12 + rang * pas - dec * pas - glisse * 1.2 * pas;
    const neuf = age < 14 && arrivee > 0;
    rows.push(
      <div key={k} style={{ position: "absolute", left: x0, top: y, width: wL, height: hl, borderRadius: 18, background: BLANC, border: `${TRAIT.MOYEN}px solid ${ENCRE}`, boxSizing: "border-box", boxShadow: `6px 7px 0 0 ${ENCRE}`, display: "flex", alignItems: "center", gap: 28, padding: "0 30px" }}>
        <div style={{ width: 70, height: 70, borderRadius: 999, background: neuf ? ACCENT_1 : IVOIRE_CLAIR, border: `${TRAIT.MOYEN}px solid ${ENCRE}`, boxSizing: "border-box", flex: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="38" height="30" viewBox="0 0 38 30">
            <rect x="2" y="3" width="34" height="24" rx="4" fill="none" stroke={ENCRE} strokeWidth="4" />
            <path d="M4 6 L19 18 L34 6" fill="none" stroke={ENCRE} strokeWidth="4" strokeLinejoin="round" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={txt(42)}>{LIGNES_DEMANDES[k % LIGNES_DEMANDES.length]}</div>
          <div style={{ marginTop: 14, width: "62%", height: 14, borderRadius: 7, background: GRIS, opacity: 0.55 }} />
        </div>
        {neuf ? <div style={{ ...txt(34), background: ACCENT_2, border: `${TRAIT.MOYEN}px solid ${ENCRE}`, borderRadius: 999, padding: "10px 22px" }}>NOUVEAU</div> : null}
      </div>,
    );
  }
  return <div style={{ position: "absolute", inset: 0, background: IVOIRE_CLAIR }}>{rows}</div>;
}

/* ------------------------------------------------------------------ Appel qui sonne (CercleEpaule) ------------------------------------------------------------------ */
const COMBINE = "M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z";

/** Écran d'appel entrant : combiné qui sonne (secoué toutes les 3 i), ondes qui s'élargissent, bandeau « APPEL ». Remplit une boîte carrée `d`. */
export function AppelEntrant({ f, d, palette, calme = 9999 }: { f: number; d: number; palette: Palette; calme?: number }) {
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const sonne = f < calme;
  const secoue = sonne ? Math.sin((f * 2 * Math.PI) / 4) * 14 * (f % 24 < 18 ? 1 : 0.2) : 0;
  const ondes = [0, 8, 16].map((dec) => {
    const k = ((f + 24 - dec) % 24) / 24;
    return { r: lerp(0.2, 0.52, k) * d, o: 1 - k };
  });
  return (
    <div style={{ position: "absolute", inset: 0, background: IVOIRE_CLAIR }}>
      {(sonne ? ondes : []).map((o, i) => (
        <div key={i} style={{ position: "absolute", left: d / 2 - o.r, top: d * 0.54 - o.r, width: 2 * o.r, height: 2 * o.r, borderRadius: 999, border: `${10 * o.o + 3}px solid ${ACCENT_1}`, boxSizing: "border-box", opacity: o.o }} />
      ))}
      <Ancre x={d / 2} y={d * 0.54} transform={`rotate(${secoue.toFixed(2)}deg)`}>
        <div style={{ width: d * 0.38, height: d * 0.38, borderRadius: 999, background: ACCENT_1, border: `${TRAIT.FORT}px solid ${ENCRE}`, boxSizing: "border-box", boxShadow: `6px 7px 0 0 ${ENCRE}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={d * 0.22} height={d * 0.22} viewBox="0 0 24 24">
            <path d={COMBINE} fill={ENCRE} />
          </svg>
        </div>
      </Ancre>
      <div style={{ position: "absolute", left: 0, right: 0, top: d * 0.07, display: "flex", justifyContent: "center" }}>
        <div style={{ ...txt(44), background: ENCRE, color: BLANC, borderRadius: 999, padding: "12px 34px", border: `${TRAIT.MOYEN}px solid ${ENCRE}`, boxShadow: `0 0 0 4px ${IVOIRE_CLAIR}` }}>
          APPEL
          <span style={{ color: ACCENT_2 }}> ●</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Signature sur écran (FenetreTelephone, FenetreDouble B) ------------------------------------------------------------------ */
const TRACE_SIGNATURE = "M20 80 C 40 20, 70 20, 80 60 S 105 100, 120 55 C 128 30, 150 30, 150 62 S 190 90, 214 44 C 224 28, 238 40, 232 62 L 300 56";

/** Trait de signature qui se trace entre `debut` et `debut + n` (viewBox 320 × 120). */
export function Signature({ f, debut, n, largeur, epaisseur = 9, couleur = ENCRE }: { f: number; debut: number; n: number; largeur: number; epaisseur?: number; couleur?: string }) {
  const p = prog(f, debut, n);
  const LONGUEUR = 560;
  return (
    <svg width={largeur} height={largeur * 0.375} viewBox="0 0 320 120" style={{ overflow: "visible" }}>
      <path d={TRACE_SIGNATURE} fill="none" stroke={couleur} strokeWidth={epaisseur * (320 / largeur)} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={LONGUEUR} strokeDashoffset={LONGUEUR * (1 - p)} />
    </svg>
  );
}

/** Écran de signature d'un devis : lignes de texte grises, cadre de signature qui se remplit, bouton VALIDER qui passe ACCENT à `iTouche`. Boîte `l` × `h`. */
/** `textes` : [en-tête, légende du cadre, case à cocher] ; absent : « DEVIS », « SIGNATURE », « J'ACCEPTE » ; "" : aucun texte (vidéo où ces mots ne sont pas dits). */
export function EcranSignature({ f, l, h, palette, iTrace, iTouche, bouton, textes = ["DEVIS", "SIGNATURE", "J'ACCEPTE"] }: { f: number; l: number; h: number; palette: Palette; iTrace: number; iTouche: number; bouton: string; textes?: [string, string, string] }) {
  const { ACCENT_1 } = accents(palette);
  const touche = f >= iTouche;
  const bl = l * 0.78;
  const bh = 104;
  return (
    <div style={{ position: "absolute", inset: 0, background: IVOIRE_CLAIR }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: 150, background: ENCRE, display: "flex", alignItems: "flex-end", padding: "0 34px 22px", boxSizing: "border-box" }}>
        <div style={txt(52, BLANC)}>{textes[0]}</div>
        <div style={{ marginLeft: "auto", width: 46, height: 46, borderRadius: 999, background: ACCENT_1, border: `${TRAIT.MOYEN}px solid ${BLANC}`, boxSizing: "border-box" }} />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: "absolute", left: 40, top: 190 + i * 40, width: l * (i === 2 ? 0.45 : 0.78) - 40, height: 16, borderRadius: 8, background: GRIS, opacity: 0.5 }} />
      ))}
      <div style={{ position: "absolute", left: 36, top: 320, width: l - 72, height: 300, borderRadius: 16, border: `${TRAIT.MOYEN}px dashed ${ENCRE}`, boxSizing: "border-box", background: BLANC }}>
        <div style={{ position: "absolute", left: 26, top: 14, ...txt(32, GRIS) }}>{textes[1]}</div>
        <div style={{ position: "absolute", left: 28, top: 80 }}>
          <Signature f={f} debut={iTrace} n={12} largeur={l - 72 - 60} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 40, top: 680, display: "flex", alignItems: "center", gap: 24, ...txt(40) }}>
        <div style={{ width: 64, height: 64, borderRadius: 14, border: `${TRAIT.MOYEN}px solid ${ENCRE}`, background: f >= iTrace + 15 ? ACCENT_1 : BLANC, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {f >= iTrace + 15 ? (
            <svg width="40" height="40" viewBox="0 0 52 52">
              <path d="M9 27 L21 39 L43 13" fill="none" stroke={ENCRE} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset={60 * (1 - prog(f, iTrace + 16, 4))} />
            </svg>
          ) : null}
        </div>
        {textes[2]}
      </div>
      <div
        style={{
          position: "absolute",
          left: (l - bl) / 2,
          top: h - bh - 70,
          width: bl,
          height: bh,
          borderRadius: 34,
          border: `${TRAIT.MOYEN}px solid ${ENCRE}`,
          background: touche ? ACCENT_1 : BLANC,
          boxShadow: `5px 6px 0 0 ${ENCRE}`,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          ...txt(44),
          transform: `scale(${touche ? 1 - 0.06 * Math.sin(Math.PI * borne((f - iTouche) / 6)) : 1})`,
        }}
      >
        {touche ? (
          <svg width="52" height="52" viewBox="0 0 52 52">
            <path d="M9 27 L21 39 L43 13" fill="none" stroke={ENCRE} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset={60 * (1 - prog(f, iTouche + 1, 4))} />
          </svg>
        ) : null}
        {bouton}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Envoi d'un devis par e-mail (FenetreDouble A) ------------------------------------------------------------------ */
/** Fenêtre d'e-mail : objet, pièce jointe « DEVIS », bouton ENVOYER pressé à `iEnvoi`, puis un avion de papier qui part vers la droite. Boîte `l` × `h`. */
export function EmailEnvoi({ f, l, h, palette, iEnvoi }: { f: number; l: number; h: number; palette: Palette; iEnvoi: number }) {
  const { ACCENT_1, ACCENT_2 } = accents(palette);
  const k = f - iEnvoi;
  const parti = k >= 0;
  const vol = prog(k, 4, 14, (x) => x * x);
  const bl = 300;
  const bh = 92;
  const presse = parti ? 1 - 0.08 * Math.sin(Math.PI * borne(k / 5)) : 1;
  const ecrit = prog(f, 4, 10);
  return (
    <div style={{ position: "absolute", inset: 0, background: IVOIRE_CLAIR }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: 96, background: ENCRE, display: "flex", alignItems: "center", padding: "0 34px", boxSizing: "border-box" }}>
        <div style={txt(44, BLANC)}>NOUVEAU MESSAGE</div>
      </div>
      <div style={{ position: "absolute", left: 40, top: 130, ...txt(34, GRIS) }}>À</div>
      <div style={{ position: "absolute", left: 120, top: 142, width: l * 0.5, height: 16, borderRadius: 8, background: GRIS, opacity: 0.5 }} />
      <div style={{ position: "absolute", left: 40, top: 200, ...txt(34, GRIS) }}>OBJET</div>
      <div style={{ position: "absolute", left: 200, top: 190, ...txt(48) }}>VOTRE DEVIS</div>
      <div style={{ position: "absolute", left: 40, right: 40, top: 270, height: 4, background: ENCRE, opacity: 0.2 }} />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ position: "absolute", left: 40, top: 320 + i * 52, width: (l - 80) * [0.85, 0.7, 0.8, 0.4][i] * ecrit, height: 18, borderRadius: 9, background: GRIS, opacity: 0.5 }} />
      ))}
      <div style={{ position: "absolute", left: 40, top: 560, display: "flex", alignItems: "center", gap: 18, background: BLANC, border: `${TRAIT.MOYEN}px solid ${ENCRE}`, borderRadius: 16, padding: "14px 26px", boxShadow: `5px 6px 0 0 ${ENCRE}`, ...txt(40) }}>
        <svg width="34" height="42" viewBox="0 0 34 42">
          <path d="M3 3 H22 L31 12 V39 H3 Z" fill={ACCENT_2} stroke={ENCRE} strokeWidth="4" strokeLinejoin="round" />
        </svg>
        DEVIS.PDF
      </div>
      {!parti || k < 5 ? (
        <div style={{ position: "absolute", left: 40, top: h - bh - 56, width: bl, height: bh, borderRadius: 24, background: parti ? BLANC : ACCENT_1, border: `${TRAIT.MOYEN}px solid ${ENCRE}`, boxShadow: `5px 6px 0 0 ${ENCRE}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", ...txt(44), transform: `scale(${presse})`, transformOrigin: "0% 50%" }}>ENVOYER</div>
      ) : null}
      {parti && k >= 6 ? <Coche f={k} debut={6} d={92} fond={ACCENT_1} style={{ position: "absolute", left: 40, top: h - bh - 56 }} /> : null}
      {parti && k >= 6 ? <div style={{ position: "absolute", left: 160, top: h - bh - 56 + 28, ...txt(48) }}>ENVOYÉ</div> : null}
      {parti ? (
        <svg width="190" height="160" viewBox="0 0 190 160" style={{ position: "absolute", left: lerp(l * 0.28, l * 1.12, vol), top: lerp(h * 0.5, h * 0.12, vol), transform: `rotate(${lerp(-8, -24, vol)}deg)`, overflow: "visible" }}>
          <path d="M4 70 L186 4 L120 156 L92 100 Z" fill={ACCENT_1} stroke={ENCRE} strokeWidth="9" strokeLinejoin="round" />
          <path d="M92 100 L186 4" fill="none" stroke={ENCRE} strokeWidth="8" />
        </svg>
      ) : null}
    </div>
  );
}

/** Document signé, net : lignes grises, signature tracée à `iTrace`, tampon « SIGNÉ » qui CLAQUE à `iTampon`. Boîte `l` × `h`. */
export function DocumentSigne({ f, l, h, palette, iTrace, iTampon }: { f: number; l: number; h: number; palette: Palette; iTrace: number; iTampon: number }) {
  const { ACCENT_1 } = accents(palette);
  const secoue = secousse(f - iTampon, 6);
  return (
    <div style={{ position: "absolute", inset: 0, background: BLANC }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: 14, background: ACCENT_1 }} />
      <div style={{ position: "absolute", left: 28, top: 38, ...txt(40) }}>DEVIS</div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ position: "absolute", left: 28, top: 100 + i * 34, width: (l - 56) * (i === 3 ? 0.5 : 0.92), height: 12, borderRadius: 6, background: GRIS, opacity: 0.5 }} />
      ))}
      <div style={{ position: "absolute", left: 28, top: h * 0.58, width: l * 0.62, height: 4, background: ENCRE }} />
      <div style={{ position: "absolute", left: 28, top: h * 0.58 - l * 0.62 * 0.3 + 28 }}>
        <Signature f={f} debut={iTrace} n={14} largeur={l * 0.62} epaisseur={7} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Liste qui se coche toute seule (AvantApres, APRÈS) ------------------------------------------------------------------ */
const TACHES = ["DEMANDE REÇUE", "DEVIS PRÊT", "DEVIS ENVOYÉ", "RELANCE FAITE", "DEVIS SIGNÉ"];
const PAS_TACHE = 9;

/** Liste de tâches qui se cochent seules, une toutes les 9 images à partir de `depuis`. Zone utile : x de `gauche` à `l`. */
export function ListeAuto({ f, l, h, palette, depuis, gauche }: { f: number; l: number; h: number; palette: Palette; depuis: number; gauche: number }) {
  const { ACCENT_1 } = accents(palette);
  const hl = 150;
  const gap = 18;
  const x0 = gauche + 20;
  const wL = l - x0 - 40;
  const total = TACHES.length * hl + (TACHES.length - 1) * gap;
  const y0 = (h - total) / 2;
  return (
    <div style={{ position: "absolute", inset: 0, background: IVOIRE_CLAIR }}>
      {TACHES.map((t, i) => {
        const fi = depuis + i * PAS_TACHE;
        const e = lerp(0.9, 1, ress("POP", f, fi));
        const fait = f >= fi + 3;
        return (
          <div key={t} style={{ position: "absolute", left: x0, top: y0 + i * (hl + gap), width: wL, height: hl, borderRadius: 20, background: fait ? BLANC : IVOIRE_CLAIR, border: `${TRAIT.MOYEN}px solid ${ENCRE}`, boxSizing: "border-box", boxShadow: `6px 7px 0 0 ${ENCRE}`, display: "flex", alignItems: "center", gap: 26, padding: "0 28px", transform: `scale(${f >= fi ? e : 1})` }}>
            <div style={{ width: 76, height: 76, borderRadius: 16, background: fait ? ACCENT_1 : BLANC, border: `${TRAIT.MOYEN}px solid ${ENCRE}`, boxSizing: "border-box", flex: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {fait ? (
                <svg width="52" height="52" viewBox="0 0 52 52">
                  <path d="M9 27 L21 39 L43 13" fill="none" stroke={ENCRE} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset={60 * (1 - prog(f, fi + 3, 4))} />
                </svg>
              ) : null}
            </div>
            <div style={txt(44)}>{t}</div>
          </div>
        );
      })}
    </div>
  );
}
