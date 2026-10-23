/**
 * Modèle 13 — DOCUMENTAIRE (lot F2) : une carte sobre de reportage. Les coins du viseur se dessinent, le repère de
 * lieu se trace, le LIEU s'écrit lettre à lettre derrière un curseur orange, la date suit, puis le chiffre clé compte
 * et son sens s'écrit. Un filet orange descend le long du bloc à mesure que les éléments arrivent.
 * Jamais de nom de personne, jamais de bandeau « nom · marque » (consigne de Will, garde-fou des schémas).
 */
import type { MiseEnPageCarte } from "../../../../src/briques/motion/types";
import type { DonneesDocumentaire } from "../../../../src/briques/motion/types-etendus";
import { avecOpacite, CarteMotion, COULEURS, DUREES, progres, TexteCinetique, useMotion, valeurCompteur } from "./noyau";
import { texteValeur, TRACES_REPERE } from "./outils-etendus";
import { DocumentaireSpectaculaire } from "./spectaculaire/DocumentaireSpectaculaire";

/** Vitesse de frappe (s par caractère). */
export const FRAPPE = 0.045;

/** Horaires d'une carte documentaire : lieu, date, chiffre et contexte s'enchaînent depuis l'instant dit. */
export function horairesDocumentaire(d: DonneesDocumentaire, debut: number) {
  const tLieu = debut;
  const finLieu = d.lieu ? tLieu + d.lieu.length * FRAPPE : tLieu;
  const tDate = d.lieu ? finLieu + 0.2 : debut;
  const finDate = d.date ? tDate + d.date.length * FRAPPE : tDate;
  const tChiffre = d.date || d.lieu ? finDate + 0.3 : debut;
  const tContexte = tChiffre + (d.chiffre ? 1.0 : 0.1);
  return { tLieu, finLieu, tDate, finDate, tChiffre, tContexte };
}

/** Texte frappé caractère par caractère, avec un curseur orange qui clignote puis s'efface. */
export function TexteFrappe({ texte, debut, t, taille, graisse, couleur, approche = 0.02, majuscules = false, curseur = true }: { texte: string; debut: number; t: number; taille: number; graisse: number; couleur: string; approche?: number; majuscules?: boolean; curseur?: boolean }) {
  const n = Math.max(0, Math.min(texte.length, Math.floor((t - debut) / FRAPPE)));
  const fin = debut + texte.length * FRAPPE;
  const visibleCurseur = curseur && t >= debut - 0.2 && t < fin + 0.7 && (t < fin || Math.floor((t - fin) / 0.25) % 2 === 0);
  return (
    <div style={{ fontSize: taille, fontWeight: graisse, letterSpacing: `${approche}em`, lineHeight: 1.08, color: couleur, whiteSpace: "pre-wrap", textTransform: majuscules ? "uppercase" : undefined }}>
      {texte.slice(0, n)}
      <span style={{ visibility: "hidden" }}>{texte.slice(n)}</span>
      {visibleCurseur && <span style={{ display: "inline-block", width: taille * 0.09, height: taille * 0.9, marginLeft: taille * 0.06, verticalAlign: "-0.08em", background: COULEURS.orangeVif, boxShadow: `0 0 ${taille * 0.2}px ${avecOpacite(COULEURS.orangeVif, 0.7)}`, position: "relative", left: -taille * 0.06 - (texte.length - n) * 0 }} />}
    </div>
  );
}

/** Coins du viseur (reportage) qui se dessinent aux 4 angles de la zone. */
function Viseur() {
  const { t, u, zone, chute } = useMotion();
  const k = progres(t, 0.05, 0.6, "glisse");
  const s = progres(t, chute, DUREES.sortie, "sortie");
  const bras = 70 * u * k;
  const ep = Math.max(3, 4 * u);
  const m = -18 * u;
  const coins = [
    { x: zone.x + m, y: zone.y + m, sx: 1, sy: 1 },
    { x: zone.x + zone.largeur - m, y: zone.y + m, sx: -1, sy: 1 },
    { x: zone.x + m, y: zone.y + zone.hauteur - m, sx: 1, sy: -1 },
    { x: zone.x + zone.largeur - m, y: zone.y + zone.hauteur - m, sx: -1, sy: -1 },
  ];
  return (
    <>
      {coins.map((c, i) => (
        <div key={i} style={{ position: "absolute", left: c.x, top: c.y, opacity: 0.7 * (1 - s) }}>
          <div style={{ position: "absolute", left: c.sx > 0 ? 0 : -bras, top: c.sy > 0 ? 0 : -ep, width: bras, height: ep, background: COULEURS.cremeAttenuee }} />
          <div style={{ position: "absolute", left: c.sx > 0 ? 0 : -ep, top: c.sy > 0 ? 0 : -bras, width: ep, height: bras, background: COULEURS.cremeAttenuee }} />
        </div>
      ))}
    </>
  );
}

/** Repère de lieu tracé (Lucide « map-pin »). */
export function Repere({ taille, debut, t, couleur, epaisseur = 2.2 }: { taille: number; debut: number; t: number; couleur: string; epaisseur?: number }) {
  const k1 = progres(t, debut, 0.55, "glisse");
  const k2 = progres(t, debut + 0.25, 0.4, "glisse");
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke={couleur} strokeWidth={epaisseur} strokeLinecap="round" strokeLinejoin="round" style={{ overflow: "visible" }}>
      <path d={TRACES_REPERE.d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={(1 - k1).toFixed(4)} opacity={k1 > 0.04 ? 1 : 0} />
      <circle cx={TRACES_REPERE.cercle.cx} cy={TRACES_REPERE.cercle.cy} r={TRACES_REPERE.cercle.r} pathLength={1} strokeDasharray="1 1" strokeDashoffset={(1 - k2).toFixed(4)} opacity={k2 > 0.04 ? 1 : 0} />
    </svg>
  );
}

function Contenu({ d }: { d: DonneesDocumentaire }) {
  const { t, u, zone, taille, chute, moitie } = useMotion();
  const h = horairesDocumentaire(d, Math.max(0.35, Math.min(1.2, d.aSec ?? 0.4)));
  const s = progres(t, chute, DUREES.sortie, "sortie");
  // Moitié haute : carte resserrée (lieu et chiffre plus petits, contexte omis) pour tenir dans la demi-image.
  const tTitre = moitie ? Math.round(taille("corps") * 1.15) : taille("titre");
  const grand = Math.round(moitie ? taille("titre") * 1.4 : taille("affiche") * 1.05);
  const tSecond = moitie ? taille("legende") : taille("corps");
  const contexte = moitie ? undefined : d.contexte;
  const fin = contexte ? h.tContexte + 0.4 : h.tChiffre + 0.6;
  const filet = progres(t, h.tLieu - 0.1, Math.max(0.6, fin - h.tLieu), "glisse");
  const v = d.chiffre ? valeurCompteur(t, h.tChiffre, 0, d.chiffre.valeur, 1.0) : 0;
  const decalage = (debut: number) => ({ opacity: progres(t, debut - 0.05, 0.2) * (1 - s), transform: `translateY(${((1 - progres(t, debut - 0.05, DUREES.entree)) * 24 * u - s * 30 * u).toFixed(2)}px)` });
  return (
    <>
      <Viseur />
      <div style={{ position: "absolute", left: zone.x + 10 * u, top: zone.y, width: zone.largeur - 10 * u, height: zone.hauteur, display: "flex", flexDirection: "column", justifyContent: "safe center" }}>
        <div style={{ position: "relative", paddingLeft: 44 * u, display: "flex", flexDirection: "column", gap: (moitie ? 14 : 34) * u }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: Math.max(5, 7 * u), height: `${(filet * 100).toFixed(2)}%`, borderRadius: 7 * u, background: `linear-gradient(180deg, ${COULEURS.orangeVif}, ${COULEURS.orangeProfond})`, boxShadow: `0 0 ${16 * u}px ${avecOpacite(COULEURS.orangeVif, 0.5)}`, opacity: 1 - s }} />
          {d.lieu && (
            <div style={{ display: "flex", alignItems: "center", gap: 18 * u, ...decalage(h.tLieu) }}>
              <div style={{ flex: "none" }}>
                <Repere taille={tTitre * 0.82} debut={h.tLieu - 0.25} t={t} couleur={COULEURS.orangeVif} />
              </div>
              <TexteFrappe texte={d.lieu} debut={h.tLieu} t={t} taille={tTitre} graisse={800} couleur={COULEURS.creme} majuscules approche={0.03} />
            </div>
          )}
          {d.date && (
            <div style={{ display: "flex", alignItems: "center", gap: 20 * u, ...decalage(h.tDate) }}>
              <div style={{ width: 56 * u * progres(t, h.tDate - 0.1, 0.4, "glisse"), height: Math.max(3, 4 * u), background: COULEURS.orange }} />
              <TexteFrappe texte={d.date} debut={h.tDate} t={t} taille={tSecond} graisse={600} couleur={COULEURS.cremeAttenuee} approche={0.08} majuscules curseur={!d.lieu} />
            </div>
          )}
          {d.chiffre && (
            <div style={{ marginTop: 20 * u, ...decalage(h.tChiffre) }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 18 * u, flexWrap: "wrap" }}>
                <span style={{ fontSize: grand, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", color: COULEURS.creme }}>{texteValeur(v, undefined, d.chiffre.decimales)}</span>
                {d.chiffre.unite && <span style={{ fontSize: tTitre * 0.82, fontWeight: 800, color: COULEURS.orangeVif, opacity: progres(t, h.tChiffre + 0.3, 0.3) }}>{d.chiffre.unite}</span>}
              </div>
              <div style={{ marginTop: 14 * u }}>
                <TexteCinetique texte={d.chiffre.libelle} niveau="corps" taillePx={tSecond} debut={h.tChiffre + 0.45} graisse={600} couleur={COULEURS.creme} largeurMax={zone.largeur - 60 * u} />
              </div>
            </div>
          )}
          {contexte && (
            <div style={decalage(h.tContexte)}>
              <TexteCinetique texte={contexte} niveau="legende" debut={h.tContexte} graisse={500} couleur={COULEURS.cremeAttenuee} largeurMax={zone.largeur - 60 * u} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function MotionDocumentaire(p: MiseEnPageCarte & { donnees: DonneesDocumentaire }) {
  if (p.style === "spectaculaire") return <DocumentaireSpectaculaire {...p} />;
  return (
    <CarteMotion mp={p} intensiteLumiere={0.65}>
      <Contenu d={p.donnees} />
    </CarteMotion>
  );
}
