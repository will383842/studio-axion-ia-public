import React from "react";
/**
 * CARTE « PILE DE NOTIFICATIONS » (designer n° 5, 15/10 — nouvelle).
 * La surcharge, les interruptions : « vous êtes dérangé toutes les dix minutes ».
 *
 * Composition (standard premium, CARTES-20-PREMIUM-2026-10-15.md) :
 *  - la carte devient un écran de verrouillage stylisé (fond ivoire-creux → sable-clair, grain), pas d'en-tête : une
 *    pilule encre en haut (l'« île » du téléphone), l'heure « 09:41 » en HÉROS encre-douce, la date en corps ;
 *  - notifications en cartes ivoire à 92 % avec micro-ombre : icône d'application nue sur fond orange-voile, nom de
 *    l'application en titre, texte court en corps, « maintenant » / « il y a 10 min » en sable-profond ;
 *  - au plus 3 notifications pleines, les plus anciennes se compriment en accordéon (lamelles de 0,006 L) ;
 *  - compteur rond orange en haut à droite : SEUL élément intérieur en relief ; tampon EXEMPLE en haut à gauche.
 * Mouvement :
 *  - N1 : la carte tombe (animationCarte), la prise descend dessous (visage entier) ;
 *  - N2 : chaque notification descend (glisse 0,18 s, translation 0,04 L) et POUSSE toute la pile vers le bas (suivi en
 *         cascade de 45 ms) ; le compteur fait +1 en claque ; sur le mot fort, toute la pile vibre (1 %, 0,2 s) ;
 *  - N3 : le point « non lu » de la dernière notification pulse ; l'île respire.
 */
import { POLICES } from "../charte";
import { Icone } from "../elements";
import { claque, Coque, DEGRADE, ecrasement, encreA, fonduEntree, glisse, grille, interieurCoque, ivoireA, microOmbre, N, pose, Reflet, reliefs, Roulant, ScenePremium, secousse, STYLE_CORPS, STYLE_HEROS, STYLE_TITRE, styleHeros, TamponExemple, typo } from "./premium-5";

export type NotificationPile = {
  /** Nom de l'application (titre, 1-2 mots). */
  app: string;
  /** Icône (nom d'`Icone`). */
  icone: string;
  /** Texte court (corps, une ligne). */
  texte: string;
  /** Instant du mot (s). */
  a: number;
};

export type PileNotificationsProps = {
  t: number;
  debut: number;
  fin: number;
  largeurImage: number;
  hauteurImage: number;
  heure?: string;
  date?: string;
  /** Valeur du compteur avant la première notification. */
  compteurDepart: number;
  notifications: NotificationPile[];
  /** Instant du mot fort : toute la pile vibre. */
  secousseA?: number;
  /** Écart affiché entre deux notifications (minutes) : « il y a 10 min »… */
  pasMinutes?: number;
  prise?: string;
  yeux?: number;
};

/** Bas de la carte (fraction de H). */
export const BAS_PILE_NOTIFICATIONS = 0.5;
const PLEINES = 3;

export function PileNotifications(p: PileNotificationsProps) {
  const W = p.largeurImage;
  const H = p.hauteurImage;
  const bas = BAS_PILE_NOTIFICATIONS;
  const ty = typo(W);
  const g = grille(W);
  const r = reliefs(W);
  const inter = interieurCoque(W, H, bas);
  const t = p.t;

  // --- Grille verticale.
  const yIle = Math.round(0.022 * W);
  const hIle = Math.round(0.03 * W);
  const tailleHeure = ty.heros(0.125);
  const yHeure = yIle + hIle + Math.round(0.01 * W);
  const yDate = yHeure + tailleHeure * 0.95;
  const yPile = yDate + ty.corps * 1.3 + Math.round(0.02 * W);
  const corpsN = Math.round(0.026 * W);
  const titreN = Math.round(0.039 * W);
  const padN = Math.round(0.015 * W);
  const hN = Math.round(padN * 2 + titreN * 1.08 + 0.006 * W + corpsN * 1.22);
  const ecartN = Math.round(0.01 * W);
  const lamelle = Math.round(0.008 * W);
  const lN = inter.l - 2 * g.marge;
  const tuile = Math.round(0.075 * W);

  // --- Pile : position (px) de l'emplacement k (0 = la plus récente).
  const slotY = (k: number) => (k < PLEINES ? k * (hN + ecartN) : (PLEINES - 1) * (hN + ecartN) + (k - PLEINES + 1) * lamelle);
  const slotEchelle = (k: number) => (k < PLEINES ? 1 : 1 - 0.045 * (k - PLEINES + 1));
  const arrivees = p.notifications.map((n) => n.a);
  const nArrivees = arrivees.filter((a) => t >= a).length;
  const pas = p.pasMinutes ?? 10;

  // --- Secousse du mot fort (1 % de L, 0,2 s) et compteur.
  const sx = p.secousseA !== undefined ? secousse(t, p.secousseA, 0.2, 0.01 * W, 20) : 0;
  const etatsCompteur = [{ valeur: String(p.compteurDepart), a: p.debut }, ...p.notifications.map((n, i) => ({ valeur: String(p.compteurDepart + i + 1), a: n.a }))];
  const dernier = nArrivees > 0 ? arrivees[nArrivees - 1] : -1;
  const claqueCompteur = dernier >= 0 ? claque(t, dernier, 0.12) : 1;
  const dCompteur = Math.round(0.092 * W);

  const contenu = (
    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${N.ivoireCreux} 0%, ${N.sableClair} 100%)` }}>
      {/* Lueur douce derrière l'heure (ivoire), pour la profondeur du « fond d'écran ». */}
      <div style={{ position: "absolute", left: "15%", right: "15%", top: -0.05 * W, height: 0.3 * W, borderRadius: "50%", background: `radial-gradient(closest-side, ${ivoireA(0.7)}, ${ivoireA(0)})` }} />
      {/* Île (pilule encre) qui respire (N3). */}
      <div style={{ position: "absolute", left: "50%", top: yIle, width: 0.17 * W * (1 + 0.04 * Math.sin(t * 4.2)), height: hIle, transform: "translateX(-50%)", borderRadius: 999, background: N.encre, boxShadow: `inset 0 1px 0 ${ivoireA(0.12)}` }}>
        <div style={{ position: "absolute", right: hIle * 0.32, top: hIle * 0.3, width: hIle * 0.4, height: hIle * 0.4, borderRadius: "50%", background: N.encreDouce }} />
      </div>
      <TamponExemple t={t} a={p.debut + 0.18} W={W} style={{ left: g.marge, top: yIle + Math.round(0.006 * W) }} />

      {/* Heure (héros) et date (corps). */}
      <div style={{ position: "absolute", left: 0, right: 0, top: yHeure, textAlign: "center", ...STYLE_HEROS, fontSize: tailleHeure, color: N.encreDouce }}>{p.heure ?? "09:41"}</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: yDate, textAlign: "center", ...STYLE_CORPS, fontSize: ty.corps, color: N.sableProfond }}>{p.date ?? "Mercredi 15 octobre"}</div>

      {/* Compteur (seul héros en relief). */}
      <div style={{ position: "absolute", right: g.marge, top: yHeure + tailleHeure * 0.08, width: dCompteur, height: dCompteur, ...styleHeros(W, N.orange, 999), background: `linear-gradient(180deg, ${N.orangeChaud}, ${N.orangeProfond})`, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${0.88 + 0.12 * claqueCompteur})` }}>
        <Reflet rayon={dCompteur * 0.5} opacite={0.25} />
        <Roulant t={t} etats={etatsCompteur} taille={ty.titre} couleur={N.ivoire} duree={0.16} style={{ marginTop: ty.titre * 0.06 }} />
      </div>

      {/* Pile de notifications. */}
      <div style={{ position: "absolute", left: g.marge, top: yPile, width: lN, height: inter.h - yPile, transform: `translateX(${sx}px)` }}>
        {p.notifications
          .map((n, i) => ({ n, i }))
          .filter(({ n }) => t >= n.a)
          .reverse()
          .map(({ n, i }) => {
            // Rang actuel (0 = la plus récente) et animation de poussée depuis le rang précédent.
            const k = nArrivees - 1 - i;
            const entree = glisse(t, n.a, 0.18);
            // Arrivée : plaque orange 0,18 s (flash, changement franc), puis ivoire ; la plus récente respire ensuite (N3).
            const flash = t < n.a + 0.18;
            const respire = !flash ? 1 + 0.008 * Math.sin((t - n.a) * 4.5) : 1;
            let y: number;
            let echelle: number;
            if (k === 0) {
              y = slotY(0) - (1 - entree) * 0.04 * W;
              echelle = 0.97 + 0.03 * entree;
            } else {
              const pousse = pose(t, arrivees[nArrivees - 1] + 0.045 * Math.min(k, 3), 0.2);
              y = slotY(k - 1) + (slotY(k) - slotY(k - 1)) * pousse;
              echelle = slotEchelle(k - 1) + (slotEchelle(k) - slotEchelle(k - 1)) * pousse;
            }
            if (k > PLEINES + 1) return null;
            const lamee = k >= PLEINES;
            const temps = k === 0 ? "maintenant" : `il y a ${k * pas} min`;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 0,
                  top: y,
                  width: lN,
                  height: hN,
                  transform: `scale(${echelle * (k === 0 ? respire : 1)})`,
                  transformOrigin: "50% 100%",
                  opacity: k === 0 ? fonduEntree(t, n.a) : 1,
                  zIndex: 20 - k,
                  borderRadius: Math.round(0.024 * W),
                  background: lamee ? N.ivoireCreux : flash ? DEGRADE.orange : ivoireA(0.92),
                  boxShadow: `${microOmbre(W, 0.13)}, inset 0 1px 0 ${ivoireA(0.9)}`,
                  border: `${r.filet * 0.8}px solid ${encreA(0.06)}`,
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  gap: Math.round(0.022 * W),
                  padding: `0 ${padN}px`,
                }}
              >
                {lamee ? null : (
                  <>
                    <div style={{ width: tuile, height: tuile, flexShrink: 0, borderRadius: Math.round(0.02 * W), background: N.orangeVoile, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                      <Icone nom={n.icone} taille={Math.round(0.04 * W)} couleur={N.orange} epaisseur={2.4} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: Math.round(0.006 * W) }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ ...STYLE_TITRE, fontSize: titreN, color: flash ? N.ivoire : N.encre }}>{n.app}</span>
                        <span style={{ ...STYLE_CORPS, fontSize: corpsN, color: flash ? N.orangeVoile : N.sableProfond, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: corpsN * 0.4 }}>
                          {temps}
                          {k === 0 ? (
                            <span style={{ position: "relative", width: corpsN * 0.5, height: corpsN * 0.5, borderRadius: "50%", background: N.orange, boxShadow: `0 0 0 ${corpsN * (0.1 + 0.22 * (0.5 + 0.5 * Math.sin(t * 7)))}px ${N.orangeVoile}` }} />
                          ) : null}
                        </span>
                      </div>
                      <span style={{ ...STYLE_CORPS, fontSize: corpsN, color: flash ? N.ivoire : N.encreDouce, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.texte}</span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );

  const carte = <Coque t={t} debut={p.debut} fin={p.fin} W={W} H={H} bas={bas} id="pile-notifications" ecrase={ecrasement(t, arrivees.map((a) => a + 0.08), 0.018, 0.1)} enfants={contenu} />;
  if (!p.prise) return carte;
  return (
    <ScenePremium t={t} debut={p.debut} fin={p.fin} W={W} H={H} bas={bas} prise={p.prise} yeux={p.yeux}>
      {carte}
    </ScenePremium>
  );
}

/** Phrase d'exemple : « Un mail, un appel, un message, une réunion… toutes les dix minutes, vous êtes dérangé. » */
export const PHRASE_PILE_NOTIFICATIONS = "Un mail, un appel, un message, une réunion… toutes les dix minutes, vous êtes dérangé.";

export const EXEMPLE_PILE_NOTIFICATIONS = {
  debut: 0,
  fin: 5.0,
  heure: "09:41",
  date: "Mercredi 15 octobre",
  compteurDepart: 8,
  pasMinutes: 10,
  notifications: [
    { app: "Mail", icone: "mail", texte: "Relance : le devis attend toujours", a: 0.15 }, // « Un mail »
    { app: "Téléphone", icone: "telephone", texte: "Appel manqué · 2 appels", a: 0.75 }, // « un appel »
    { app: "Messages", icone: "message", texte: "Vous avez 3 nouveaux messages", a: 1.35 }, // « un message »
    { app: "Agenda", icone: "calendrier", texte: "Réunion d'équipe dans 5 min", a: 2.0 }, // « une réunion »
  ],
  secousseA: 3.75, // « dérangé »
} satisfies Omit<PileNotificationsProps, "t" | "largeurImage" | "hauteurImage">;

/** Instant le plus représentatif pour une image fixe (4 notifications, accordéon, compteur à 12). */
export const INSTANT_FIXE_PILE_NOTIFICATIONS = 2.6;
/** Instant « en construction » (2ᵉ notification qui pousse la 1ʳᵉ). */
export const INSTANT_CONSTRUCTION_PILE_NOTIFICATIONS = 0.84;
