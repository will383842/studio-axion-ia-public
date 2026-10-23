/**
 * FAMILLE « TÉLÉPHONE DONT L'ÉCRAN S'ANIME » (`telephone`) — motion designer n° 1, 15/10/2026.
 *
 * Quand : Will parle d'e-mail, de relance, de rendez-vous, de visio, de message ou de lien en commentaire.
 * Visage : ENTIER (le téléphone se place à droite du buste et ne monte JAMAIS au-dessus du menton, 0,53 H).
 *
 * Mouvement :
 *  - un téléphone stylisé (coque encre, écran ivoire, ombre dure) MONTE du bas en tournant et se pose incliné, puis flotte ;
 *  - sur son écran, trois événements possibles, chacun sur son mot, chacun change franchement tout l'écran (≥ 5 % de l'image) :
 *     « frappe »       : le clavier jaillit, le message se tape lettre à lettre (touches qui s'allument), puis part :
 *                        l'écran claque en orange 2 images, la bulle saute dans la conversation, double coche ;
 *     « notification » : un bandeau tombe du haut de l'écran, la conversation se floute (l'écran reste ivoire),
 *                        le téléphone VIBRE (3 arcs courts au coin haut droit de la coque) ;
 *     « coche »        : un disque orange envahit l'écran depuis le centre et une grande coche ivoire se trace.
 *  - sortie : le téléphone retombe en tournant.
 *  Durée bornée à 1,5-3 s. Bruitages : frappe (une touche par lettre), vibration, petit carillon de validation.
 *
 * Calque à poser AU-DESSUS de la prise (qui ne bouge jamais). Aucun chiffre affiché (ni heure, ni batterie).
 * Textes : uniquement des mots dits par Will.
 */
import React from "react";
import { COULEURS, POLICES, largeurTexte } from "../charte";
import { Icone, mesures } from "../elements";
import { progression, rebond, sortie } from "../mouvement";

export const ID_TELEPHONE = "telephone";

export type EvenementTelephone =
  | { genre: "frappe"; texte: string; a: number; /** Instant de l'envoi (défaut : à la fin de la frappe). */ envoiA?: number }
  | { genre: "notification"; titre: string; texte: string; a: number; icone?: string }
  | { genre: "coche"; texte: string; a: number };

export type DonneesTelephone = {
  debut: number;
  /** Fin souhaitée ; la durée est ramenée dans [1,5 ; 3] s. */
  fin: number;
  /** Nom affiché en tête de conversation (mot dit, ex. « Axion-IA »). */
  titre: string;
  evenements: EvenementTelephone[];
};

export const EXEMPLE_PHRASE_TELEPHONE = "Réservez votre appel diagnostic gratuit.";
export const EXEMPLE_TELEPHONE: DonneesTelephone = {
  debut: 0.1,
  fin: 3.0,
  titre: "Axion-IA",
  evenements: [
    { genre: "frappe", texte: "Réservez votre appel diagnostic", a: 0.42, envoiA: 1.55 },
    { genre: "notification", titre: "Axion-IA", texte: "Appel diagnostic", a: 1.95, icone: "calendrier" },
    { genre: "coche", texte: "Gratuit", a: 2.36 },
  ],
};
export const INSTANTS_TELEPHONE = Object.freeze({ construction: 1.1, complete: 2.75 });

export const FICHE_TELEPHONE = Object.freeze({
  id: ID_TELEPHONE,
  nom: "Téléphone dont l'écran s'anime",
  visage: "entier" as const,
  dureeMin: 1.5,
  dureeMax: 3,
  /** Quota partagé avec la pile de notifications (designer 2) : une seule des deux par vidéo. */
  groupe: "notification" as const,
  parVideoMax: 1,
  /** Le téléphone occupe le bas droit : les sous-titres passent en haut à gauche pendant toute sa présence. */
  sousTitres: "haut-gauche" as const,
  quandUtiliser: "E-mail, relance, rendez-vous, visio, message, lien en commentaire. Une par vidéo (pile de notifications comprise).",
});

const ENTREE = 0.26;
const SORTIE = 0.18;
/** Géométrie (fractions) : bord droit à 0,955 L, haut posé à 0,55 H, jamais au-dessus de 0,53 H (menton ≈ 0,50 H). */
const GEO = Object.freeze({ largeur: 0.355, rapport: 2.04, droite: 0.955, haut: 0.55, hautMin: 0.53, inclinaison: -5 });
/** Dérivés autorisés de la charte. */
const IVOIRE_FONCE = "#DCCDB5";
const ENCRE_RELEVEE = "#2A1E15";
const CLAVIER = "#D3C2A6";

export function tempsTelephone(d: DonneesTelephone) {
  const duree = Math.min(FICHE_TELEPHONE.dureeMax, Math.max(FICHE_TELEPHONE.dureeMin, d.fin - d.debut));
  return { fin: d.debut + duree, sortie: d.debut + duree - SORTIE };
}

/** Instants d'une frappe : clavier, première lettre, dernière lettre, envoi. */
function tempsFrappe(e: Extract<EvenementTelephone, { genre: "frappe" }>) {
  const envoi = e.envoiA ?? e.a + Math.min(1.3, 0.12 + 0.045 * e.texte.length + 0.12);
  const debutFrappe = e.a + 0.1;
  const finFrappe = Math.max(debutFrappe + 0.05, envoi - 0.1);
  return { debutFrappe, finFrappe, envoi, pas: (finFrappe - debutFrappe) / Math.max(1, e.texte.length) };
}

const hasard = (i: number) => {
  const x = Math.sin(i * 91.17 + 12.3) * 24634.6345;
  return x - Math.floor(x);
};

/** Clavier stylisé : 3 rangées de touches sans lettres + barre d'espace ; la touche frappée s'allume en orange. */
function Clavier({ l, h, toucheActive }: { l: number; h: number; toucheActive: number }) {
  const rangs = [10, 9, 7];
  const gap = l * 0.014;
  const hTouche = (h - gap * 6) / 4;
  let k = 0;
  return (
    <div style={{ width: l, height: h, background: CLAVIER, padding: gap, boxSizing: "border-box", display: "flex", flexDirection: "column", gap }}>
      {rangs.map((n, r) => (
        <div key={r} style={{ display: "flex", gap, justifyContent: "center", height: hTouche }}>
          {Array.from({ length: n }, () => {
            const i = k++;
            const actif = i === toucheActive;
            return <div key={i} style={{ width: (l - gap * 11) / 10, height: hTouche, borderRadius: hTouche * 0.18, background: actif ? COULEURS.orange : COULEURS.ivoire, boxShadow: `0 ${Math.max(2, hTouche * 0.06)}px 0 ${actif ? COULEURS.encre : "#B9A587"}`, transform: actif ? `translateY(${hTouche * 0.06}px)` : undefined }} />;
          })}
        </div>
      ))}
      <div style={{ display: "flex", gap, justifyContent: "center", height: hTouche }}>
        <div style={{ width: l * 0.18, borderRadius: hTouche * 0.18, background: "#C4B293" }} />
        <div style={{ width: l * 0.48, borderRadius: hTouche * 0.18, background: COULEURS.ivoire, boxShadow: `0 ${Math.max(2, hTouche * 0.06)}px 0 #B9A587` }} />
        <div style={{ width: l * 0.18, borderRadius: hTouche * 0.18, background: "#C4B293" }} />
      </div>
    </div>
  );
}

/** Contenu de l'écran (sl × sh px) au temps t. */
function Ecran({ t, d, sl, sh, W }: { t: number; d: DonneesTelephone; sl: number; sh: number; W: number }) {
  const m = mesures(W);
  const u = sl / 100; // unité d'écran
  const frappe = d.evenements.find((e): e is Extract<EvenementTelephone, { genre: "frappe" }> => e.genre === "frappe");
  const notif = d.evenements.find((e): e is Extract<EvenementTelephone, { genre: "notification" }> => e.genre === "notification");
  const coche = d.evenements.find((e): e is Extract<EvenementTelephone, { genre: "coche" }> => e.genre === "coche");

  // --- Frappe et envoi.
  const tf = frappe ? tempsFrappe(frappe) : null;
  const nTape = frappe && tf ? Math.max(0, Math.min(frappe.texte.length, Math.floor((t - tf.debutFrappe) / tf.pas) + 1)) : 0;
  const envoye = !!tf && t >= tf.envoi;
  const tapeVisible = frappe && tf && t >= tf.debutFrappe && !envoye ? frappe.texte.slice(0, nTape) : "";
  const hClavier = sh * 0.34;
  const eClavier = frappe && tf ? rebond(t, frappe.a, 0.16, 1.4) * (1 - sortie(t, tf.envoi + 0.06, 0.14)) : 0;
  const toucheActive = frappe && tf && t >= tf.debutFrappe && !envoye ? Math.floor(hasard(nTape) * 26) : -1;
  const curseur = Math.floor(t * 4) % 2 === 0;
  const claque = !!tf && t >= tf.envoi && t < tf.envoi + 0.08;
  const eBulle = tf ? rebond(t, tf.envoi, 0.2, 2) : 0;
  const lu = tf ? progression(t, tf.envoi + 0.3, 0.12) : 0;

  // --- Notification.
  const eNotif = notif ? rebond(t, notif.a, 0.2, 1.6) : 0;
  // L'écran reste ivoire : seule la conversation se floute et s'efface à moitié derrière le bandeau.
  const flou = notif && t >= notif.a ? progression(t, notif.a, 0.08) : 0;

  // --- Coche.
  const eDisque = coche ? progression(t, coche.a, 0.16) : 0;
  const trace = coche ? progression(t, coche.a + 0.12, 0.18) : 0;
  const eLibelle = coche ? rebond(t, coche.a + 0.22, 0.18, 2.2) : 0;

  const hBarre = sh * 0.045;
  const hEntete = sh * 0.11;
  const hSaisie = sh * 0.09;
  const ySaisie = sh - hSaisie - u * 3 - hClavier * eClavier;
  const tailleTexte = u * 6.4;

  return (
    <div style={{ position: "relative", width: sl, height: sh, background: COULEURS.ivoire, overflow: "hidden" }}>
      {/* Barre d'état : signal et batterie dessinés, AUCUN chiffre. */}
      <div style={{ height: hBarre, display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: `0 ${u * 9}px` }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: u * 1.2 }}>
          {[0.4, 0.6, 0.8, 1].map((k, i) => (
            <div key={i} style={{ width: u * 1.6, height: hBarre * 0.45 * k, background: COULEURS.encre, borderRadius: u * 0.5 }} />
          ))}
        </div>
        <div style={{ width: u * 9, height: hBarre * 0.4, border: `${u * 0.8}px solid ${COULEURS.encre}`, borderRadius: u * 1.4, boxSizing: "border-box", padding: u * 0.6 }}>
          <div style={{ width: "70%", height: "100%", background: COULEURS.encre, borderRadius: u * 0.5 }} />
        </div>
      </div>
      {/* En-tête de conversation. */}
      <div style={{ height: hEntete, display: "flex", alignItems: "center", gap: u * 3.5, padding: `0 ${u * 6}px`, borderBottom: `${Math.max(2, u * 0.7)}px solid ${COULEURS.sable}` }}>
        <div style={{ width: hEntete * 0.62, height: hEntete * 0.62, borderRadius: "50%", background: COULEURS.orange, border: `${Math.max(2, u * 0.8)}px solid ${COULEURS.encre}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icone nom="utilisateurs" taille={hEntete * 0.34} couleur={COULEURS.ivoire} epaisseur={2.6} />
        </div>
        <div style={{ fontFamily: POLICES.titre, fontSize: u * 7, color: COULEURS.encre, whiteSpace: "nowrap", overflow: "hidden" }}>{d.titre}</div>
      </div>
      {/* Conversation : bulle reçue sans texte (lignes) puis la bulle envoyée ; floutée sous une notification. */}
      <div style={{ position: "absolute", inset: 0, filter: flou > 0 ? `blur(${u * 1.1 * flou}px)` : undefined, opacity: 1 - 0.4 * flou }}>
      <div style={{ position: "absolute", left: u * 6, top: hBarre + hEntete + u * 6, width: sl * 0.58, padding: u * 4, background: IVOIRE_FONCE, borderRadius: `${u * 5}px ${u * 5}px ${u * 5}px ${u * 1.2}px`, boxSizing: "border-box", display: "flex", flexDirection: "column", gap: u * 2.4 }}>
        {[1, 0.78, 0.5].map((k, i) => (
          <div key={i} style={{ width: `${100 * k}%`, height: u * 2.6, background: COULEURS.sable, borderRadius: 999 }} />
        ))}
      </div>
      {frappe && envoye ? (
        <div
          style={{
            position: "absolute",
            right: u * 6,
            top: hBarre + hEntete + u * 36,
            maxWidth: sl * 0.8,
            padding: `${u * 3.4}px ${u * 4.6}px`,
            wordBreak: "normal",
            overflowWrap: "normal",
            hyphens: "none",
            background: COULEURS.orange,
            color: COULEURS.ivoire,
            fontFamily: POLICES.texte,
            fontSize: tailleTexte,
            lineHeight: 1.22,
            borderRadius: `${u * 5}px ${u * 5}px ${u * 1.2}px ${u * 5}px`,
            border: `${Math.max(2, u * 0.7)}px solid ${COULEURS.encre}`,
            boxShadow: `${u * 1.2}px ${u * 1.2}px 0 ${COULEURS.encre}`,
            transformOrigin: "100% 100%",
            transform: `translateY(${(1 - eBulle) * sh * 0.35}px) scale(${0.5 + 0.5 * eBulle})`,
          }}
        >
          {frappe.texte}
          {lu > 0 ? (
            <div style={{ position: "absolute", right: u * 1, bottom: -u * 8, display: "flex", opacity: lu }}>
              <Icone nom="coche" taille={u * 6} couleur={COULEURS.orange} epaisseur={3.2} />
              <div style={{ marginLeft: -u * 3.4 }}>
                <Icone nom="coche" taille={u * 6} couleur={COULEURS.orange} epaisseur={3.2} />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      </div>
      {/* Champ de saisie + bouton d'envoi. */}
      <div style={{ position: "absolute", left: u * 4, right: u * 4, top: ySaisie, height: hSaisie, display: "flex", alignItems: "center", gap: u * 2.5 }}>
        <div style={{ flex: 1, height: hSaisie * 0.78, borderRadius: 999, background: IVOIRE_FONCE, border: `${Math.max(2, u * 0.6)}px solid ${COULEURS.sable}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: `0 ${u * 4}px`, overflow: "hidden" }}>
          <span style={{ fontFamily: POLICES.texte, fontSize: tailleTexte * 0.92, color: COULEURS.encre, whiteSpace: "nowrap" }}>{tapeVisible}</span>
          {frappe && tf && t >= frappe.a && !envoye ? <span style={{ width: u * 0.9, height: tailleTexte * 1.1, marginLeft: u * 0.6, background: curseur ? COULEURS.orange : "transparent" }} /> : null}
        </div>
        <div style={{ width: hSaisie * 0.78, height: hSaisie * 0.78, borderRadius: "50%", background: COULEURS.orange, border: `${Math.max(2, u * 0.7)}px solid ${COULEURS.encre}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${claque ? 0.82 : 1})` }}>
          <Icone nom="envoyer" taille={hSaisie * 0.4} couleur={COULEURS.ivoire} epaisseur={2.6} />
        </div>
      </div>
      {/* Clavier. */}
      {eClavier > 0 ? (
        <div style={{ position: "absolute", left: 0, top: sh - hClavier * eClavier, width: sl }}>
          <Clavier l={sl} h={hClavier} toucheActive={toucheActive} />
        </div>
      ) : null}
      {/* Claquement d'envoi : l'écran passe en orange 2 images. */}
      {claque ? <div style={{ position: "absolute", inset: 0, background: COULEURS.orange, opacity: 0.85 }} /> : null}
      {/* Notification : bandeau qui tombe (la conversation est déjà floutée). */}
      {notif && t >= notif.a ? (
        <div
          style={{
            position: "absolute",
            left: u * 4,
            right: u * 4,
            top: hBarre + u * 2,
            padding: u * 3.6,
            background: ENCRE_RELEVEE,
            border: `${Math.max(2, u * 0.7)}px solid ${COULEURS.encre}`,
            borderRadius: u * 5,
            boxShadow: `0 ${u * 1.6}px 0 ${COULEURS.encre}`,
            display: "flex",
            alignItems: "center",
            gap: u * 3.4,
            transform: `translateY(${-(1 - eNotif) * sh * 0.3}px)`,
          }}
        >
          <div style={{ width: u * 13, height: u * 13, borderRadius: u * 3.4, background: COULEURS.orange, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icone nom={notif.icone ?? "cloche"} taille={u * 8} couleur={COULEURS.ivoire} epaisseur={2.6} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: u * 0.8, minWidth: 0 }}>
            <span style={{ fontFamily: POLICES.titre, fontSize: u * 5.4, color: COULEURS.ivoire, whiteSpace: "nowrap" }}>{notif.titre}</span>
            <span style={{ fontFamily: POLICES.texte, fontSize: u * 5, color: COULEURS.sable, whiteSpace: "nowrap", overflow: "hidden" }}>{notif.texte}</span>
          </div>
        </div>
      ) : null}
      {/* Coche : disque orange qui envahit l'écran, coche ivoire tracée, libellé. */}
      {coche && eDisque > 0 ? (
        <div style={{ position: "absolute", inset: 0, background: COULEURS.orange, clipPath: `circle(${eDisque * 120}% at 50% 48%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: u * 5 }}>
          <svg width={sl * 0.42} height={sl * 0.42} viewBox="0 0 100 100">
            <circle cx={50} cy={50} r={44} fill="none" stroke={COULEURS.ivoire} strokeWidth={7} strokeDasharray={277} strokeDashoffset={277 * (1 - Math.min(1, trace * 1.4))} transform="rotate(-90 50 50)" strokeLinecap="round" />
            <path d="M29 52 L44 66 L72 36" fill="none" stroke={COULEURS.ivoire} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={66} strokeDashoffset={66 * (1 - Math.max(0, trace * 1.4 - 0.4) / 1)} />
          </svg>
          {eLibelle > 0 ? (
            <div style={{ fontFamily: POLICES.titre, fontSize: Math.min(u * 24, (sl * 0.86) / Math.max(1e-6, largeurTexte(coche.texte.toUpperCase(), 1))), lineHeight: 1, color: COULEURS.ivoire, textTransform: "uppercase", textShadow: `${u * 1.2}px ${u * 1.2}px 0 ${COULEURS.encre}`, transform: `scale(${eLibelle})`, whiteSpace: "nowrap" }}>{coche.texte}</div>
          ) : null}
        </div>
      ) : null}
      {/* Reflet discret en diagonale. */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg, rgba(255,255,255,0) 55%, rgba(255,255,255,0.10) 56%, rgba(255,255,255,0) 72%)", pointerEvents: "none", borderRadius: m.rayon }} />
    </div>
  );
}

export function Telephone({ t, largeurImage: W, hauteurImage: H, donnees = EXEMPLE_TELEPHONE }: { t: number; largeurImage: number; hauteurImage: number; donnees?: DonneesTelephone }) {
  const d = donnees;
  const { fin, sortie: debutSortie } = tempsTelephone(d);
  if (t < d.debut || t >= fin) return null;
  const m = mesures(W);
  const l = W * GEO.largeur;
  const h = l * GEO.rapport;
  const x = W * GEO.droite - l;
  const bezel = l * 0.04;
  const sl = l - 2 * bezel;
  const sh = h - 2 * bezel;

  const e = rebond(t, d.debut, ENTREE, 1.5);
  const s = sortie(t, debutSortie, SORTIE);
  const flotte = Math.sin((t - d.debut) * 2 * Math.PI * 0.7) * H * 0.004;
  // Vibration de la notification : secousse rapide de 0,32 s.
  const notif = d.evenements.find((ev) => ev.genre === "notification");
  const kv = notif ? progression(t, notif.a, 0.32) : 1;
  const vibre = notif && t >= notif.a && kv < 1 ? Math.sin((t - notif.a) * 2 * Math.PI * 24) * (1 - kv) : 0;
  const yRepos = Math.max(GEO.hautMin * H, GEO.haut * H);
  const y = yRepos + (1 - e) * (H - yRepos + H * 0.04) + s * (H - yRepos + H * 0.08) + flotte;
  // Le dépassement de la courbe ne doit jamais faire passer le haut au-dessus du menton.
  const yBorne = Math.max(GEO.hautMin * H + l * 0.06, y);
  const rot = GEO.inclinaison + 16 * (1 - e) + 14 * s + vibre * 3.2;

  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden", pointerEvents: "none" }}>
      {/* Ondes de vibration : 3 arcs courts collés au coin haut droit de la coque (loin du micro, dans l'image). */}
      {vibre !== 0 ? (
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          {[0, 1, 2].map((k) => {
            const th = (rot * Math.PI) / 180;
            const dx = l / 2 - l * 0.06;
            const dy = -h * 0.6 + l * 0.06;
            const cx = x + vibre * W * 0.006 + l / 2 + dx * Math.cos(th) - dy * Math.sin(th);
            const cy = yBorne + h * 0.6 + dx * Math.sin(th) + dy * Math.cos(th);
            const r = l * (0.11 + 0.055 * k);
            const a0 = (-78 * Math.PI) / 180;
            const a1 = (-12 * Math.PI) / 180;
            return (
              <path
                key={k}
                d={`M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`}
                fill="none"
                stroke={k === 1 ? COULEURS.encre : COULEURS.orange}
                strokeWidth={W * 0.009}
                strokeLinecap="round"
                opacity={0.55 + 0.45 * Math.abs(vibre)}
              />
            );
          })}
        </svg>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: x + vibre * W * 0.006,
          top: yBorne,
          width: l,
          height: h,
          borderRadius: l * 0.15,
          background: COULEURS.encre,
          boxShadow: `${m.ombre * 1.4}px ${m.ombre * 1.4}px 0 rgba(17, 10, 5, 0.55)`,
          padding: bezel,
          boxSizing: "border-box",
          transformOrigin: "50% 60%",
          transform: `rotate(${rot}deg)`,
        }}
      >
        {/* Boutons latéraux. */}
        <div style={{ position: "absolute", left: -l * 0.018, top: h * 0.2, width: l * 0.022, height: h * 0.08, background: COULEURS.encre, borderRadius: 4 }} />
        <div style={{ position: "absolute", right: -l * 0.018, top: h * 0.26, width: l * 0.022, height: h * 0.12, background: COULEURS.encre, borderRadius: 4 }} />
        <div style={{ position: "relative", width: sl, height: sh, borderRadius: l * 0.11, overflow: "hidden" }}>
          <Ecran t={t} d={d} sl={sl} sh={sh} W={W} />
          {/* Îlot de la caméra. */}
          <div style={{ position: "absolute", left: sl / 2 - sl * 0.15, top: sh * 0.012, width: sl * 0.3, height: sh * 0.03, background: COULEURS.encre, borderRadius: 999 }} />
        </div>
      </div>
    </div>
  );
}

/** Bruitage : [instant (s), son de `sons/` sans extension, volume]. */
export type BruitageMotion = [number, string, number];

/** Montée (souffle), une touche par lettre, envoi, vibration (rafale), validation, retombée. */
export function bruitagesTelephone(d: DonneesTelephone = EXEMPLE_TELEPHONE): BruitageMotion[] {
  const { sortie: s } = tempsTelephone(d);
  const l: BruitageMotion[] = [[d.debut - 0.02, "whoosh-in", 0.22]];
  for (const e of d.evenements) {
    if (e.genre === "frappe") {
      const tf = tempsFrappe(e);
      const n = e.texte.length;
      for (let i = 0; i < n; i++) if (!/\s/.test(e.texte[i])) l.push([tf.debutFrappe + i * tf.pas, ["click_001", "click_002", "click_003"][i % 3], 0.035]);
      l.push([tf.envoi, "select_001", 0.1]);
    } else if (e.genre === "notification") {
      for (let k = 0; k < 8; k++) l.push([e.a + k * 0.035, k % 2 ? "tick_001" : "tick_004", 0.06]);
      l.push([e.a, "drop_002", 0.08]);
    } else {
      l.push([e.a + 0.1, "confirmation_002", 0.12]);
    }
  }
  l.push([s, "whoosh-out", 0.18]);
  return l;
}
