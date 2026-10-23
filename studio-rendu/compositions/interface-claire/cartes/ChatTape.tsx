import React from "react";
/**
 * CARTE « MESSAGE TAPÉ » (redessinée le 15/10, standard premium ; référence : carte Claude, `planche_02`).
 * Une vraie interface d'assistant, de haut en bas : la conversation (bulle de l'utilisateur encre à droite avec son
 * horodatage, réponse dans une bulle ivoire avec avatar, en VRAIS mots), une rangée de suggestions en pilules à filet
 * (sur 2 lignes si besoin, jamais coupées), puis le champ de saisie en creux avec son bouton d'envoi — l'UNIQUE héros.
 *
 * Mouvement : le champ glisse en place ; la frappe avance lettre à lettre à vitesse IRRÉGULIÈRE (déterministe), curseur
 * plein pendant la frappe puis clignotant à 2 Hz. À l'envoi, le bouton s'écrase de 8 % et la bulle MONTE du champ
 * jusqu'à sa place (0,2 s, « glisse ») ; trois points décalés, puis la réponse ligne par ligne. Chaque suggestion arrive
 * sur son mot par translation (cascade de 50 ms si plusieurs tombent ensemble). N3 : curseur, points, respiration de l'avatar.
 */
import { NUANCES, alea, couperLignes, degradeEncre, degradeOrange, fondu, glisse, largeurCorps, largeurInter, microOmbre, ombreCreux, pose, Reflet, RELIEF, styleCorps, styleHeros, TYPO } from "../variantes/premium-1";
import { Icone } from "../elements";
import { POLICES } from "../charte";

export type PuceChat = {
  /** Mot affiché dans la puce (celui que dit le présentateur). */
  texte: string;
  /** Nom d'icône (`NOMS_ICONES` d'`elements.tsx`). */
  icone?: string;
  /** Instant du mot (s). */
  a: number;
};

export type ChatTapeProps = {
  /** Temps courant (s), même horloge que la `Carte`. */
  t: number;
  /** Largeur de l'image (px). */
  largeurImage: number;
  /** Unité de taille (px) : ≈ 5 % de la hauteur de l'image (× grossissement). */
  hauteurLigne: number;
  /** Texte d'invite du champ vide (ex. « Écrivez ici… »). Facultatif. */
  indication?: string;
  /**
   * Message tapé. `a` = le champ arrive ; la frappe commence 0,1 s après.
   * `finFrappe` (s) force la fin de la frappe ; sinon `vitesse` caractères par seconde (défaut 45, ≈ 1 s par phrase).
   */
  message: { texte: string; a: number; finFrappe?: number; vitesse?: number };
  /** Réponse : `a` = le message part. `lignes` = lignes de réponse au plus (défaut 2). `texte` : réponse en clair (facultatif). */
  reponse: { a: number; lignes?: number; icone?: string; texte?: string };
  /** Une suggestion par mot dit, dans l'ordre. */
  puces: PuceChat[];
};

/** Proportions verticales (en `hauteurLigne`) : INCHANGÉES (la mise en page de `cadrage.ts` en dépend). */
const H_CHAMP = 1.3;
const ECART = 0.3;
const PAS_LIGNE = 0.34;
const H_PUCES = 0.8;

/** Hauteur du contenu (px) pour dimensionner la `Carte`. */
export function hauteurChatTape(hauteurLigne: number, nbLignes = 4) {
  return hauteurLigne * (H_CHAMP + ECART + Math.max(0.75, nbLignes * PAS_LIGNE) + ECART + H_PUCES);
}

/** Calendrier de la frappe : vitesse irrégulière mais déterministe (rafales, petites hésitations après les espaces). */
function frappe(t: number, m: ChatTapeProps["message"]) {
  const car = Array.from(m.texte);
  const debut = m.a + 0.1;
  const fin = m.finFrappe ?? debut + car.length / (m.vitesse ?? 45);
  const poids = car.map((c, i) => 0.55 + 0.9 * alea(i, 3) + (c === " " ? 0.7 : 0) + (/[,.]/.test(c) ? 1.4 : 0));
  const somme = poids.reduce((s, x) => s + x, 0);
  const ecoule = ((t - debut) / Math.max(0.01, fin - debut)) * somme;
  let n = 0;
  let cumul = 0;
  for (const p of poids) {
    if (cumul + p > ecoule) break;
    cumul += p;
    n++;
  }
  return { debut, fin, visible: car.slice(0, t < debut ? 0 : n).join("") };
}

/** Réponse par défaut : de vrais mots, adaptés au nombre de lignes demandé. */
const REPONSE_LONGUE = "Avec plaisir. Voici une première version de chaque document, prête à relire :";
const REPONSE_COURTE = "Avec plaisir, c'est prêt :";

export function ChatTape(p: ChatTapeProps) {
  const W = p.largeurImage;
  const u = p.hauteurLigne;
  const lignesMax = p.reponse.lignes ?? 2;
  const Hc = hauteurChatTape(u, lignesMax);
  const L = largeurCorps(W);
  const C = Math.max(TYPO.minimum(W), Math.min(TYPO.corps(W), Hc * 0.08));
  const lh = C * 1.3;
  const filet = RELIEF.filet(W);
  const ra = p.reponse.a;
  const envoye = p.t >= ra;

  /* ---------------- Géométrie (px, du bas vers le haut) ---------------- */
  const hChamp = Math.max(C * 2.1, Math.min(C * 2.4, Hc * 0.19));
  const yChamp = Hc - hChamp;
  const icone = W * 0.04;
  // Suggestions : corps réduit d'un cran (≥ 0,026 L) pour tenir sur une rangée quand c'est possible.
  const Cp = Math.max(TYPO.minimum(W), C * 0.88);
  const hPuce = Cp * 1.75;
  const padPuce = Cp * 0.5;
  const ecartPuce = W * 0.015;
  const largeursPuces = p.puces.map((pu) => padPuce * 2 + icone + Cp * 0.3 + largeurInter(pu.texte, Cp));
  const rangees: number[][] = [];
  largeursPuces.forEach((l, i) => {
    const r = rangees[rangees.length - 1];
    const occupe = r ? r.reduce((s, j) => s + largeursPuces[j] + ecartPuce, 0) : Infinity;
    if (!r || occupe + l > L) rangees.push([i]);
    else r.push(i);
  });
  const ecartBloc = C * 0.4;
  const hPuces = rangees.length * hPuce + (rangees.length - 1) * ecartPuce;
  const yPuces = yChamp - ecartBloc - hPuces;
  const hConversation = yPuces - ecartBloc;

  // Bulle de l'utilisateur (encre, à droite).
  const padX = C * 0.55;
  const padY = C * 0.3;
  const largeurBulleMax = L * 0.84;
  const lignesMessage = couperLignes(p.message.texte, C, largeurBulleMax - 2 * padX);
  const largeurBulle = Math.min(largeurBulleMax, Math.max(...lignesMessage.map((l) => largeurInter(l, C))) + 2 * padX);
  const hBulle = lignesMessage.length * lh + 2 * padY;

  // Réponse (avatar + bulle ivoire) : autant de lignes que la place en laisse (≤ `lignes`).
  const avatar = W * 0.055;
  const yReponse = hBulle + C * 0.35;
  const placeReponse = hConversation - yReponse;
  const largeurReponse = L - avatar - C * 0.5;
  const lignesPossibles = Math.max(1, Math.min(lignesMax, Math.floor((placeReponse - 2 * padY - 4) / lh)));
  let lignesReponse = couperLignes(p.reponse.texte ?? REPONSE_LONGUE, C, largeurReponse - 2 * padX);
  if (lignesReponse.length > lignesPossibles) lignesReponse = couperLignes(p.reponse.texte && lignesPossibles > 1 ? p.reponse.texte : REPONSE_COURTE, C, largeurReponse - 2 * padX).slice(0, lignesPossibles);

  // Avant l'envoi : accueil + champ CENTRÉS (écran d'accueil d'assistant) ; à l'envoi, le champ descend à sa place.
  const avatarAccueil = W * 0.075;
  const blocAccueil = avatarAccueil + C * 0.6 + hChamp;
  const yAccueil = Math.max(0, (Hc - blocAccueil) / 2);
  const yChampAvant = yAccueil + avatarAccueil + C * 0.6;

  /* ---------------- Temps ---------------- */
  const f = frappe(p.t, p.message);
  const eChamp = p.t >= p.message.a ? glisse(p.t, p.message.a, 0.2) : 0;
  const clignote = Math.floor((p.t - (envoye ? ra : f.fin)) / 0.25) % 2 === 0;
  const curseurVisible = p.t >= f.debut && (!envoye && p.t < f.fin ? true : clignote);
  const ecrase = envoye ? 1 - 0.08 * Math.sin(Math.PI * Math.min(1, (p.t - ra) / 0.12)) : 1;
  const monte = envoye ? glisse(p.t, ra, 0.2) : 0;
  const descendChamp = envoye ? glisse(p.t, ra, 0.22) : 0;
  const yChampVu = yChampAvant + (yChamp - yChampAvant) * descendChamp;
  const debutPoints = ra + 0.2;
  const debutTexte = ra + 0.55;
  const respire = 1 + 0.025 * Math.sin(p.t * Math.PI * 1.6);

  const texteChamp = envoye ? "" : f.visible;
  const placeChamp = L - hChamp * 0.72 - C * 1.6;
  const deborde = largeurInter(texteChamp, C) > placeChamp;

  return (
    <div style={{ position: "relative", height: Hc }}>
      {/* Accueil, avant l'envoi : avatar + invite, au-dessus du champ centré. */}
      {p.t >= p.message.a && p.t < ra + 0.12 ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: yAccueil, height: avatarAccueil, display: "flex", alignItems: "center", justifyContent: "center", gap: C * 0.5, opacity: (1 - fondu(p.t, ra)) * fondu(p.t, p.message.a), transform: `translateY(${-W * 0.02 * glisse(p.t, ra, 0.12) + (1 - eChamp) * W * 0.02}px)` }}>
          <Avatar W={W} taille={avatarAccueil} icone={p.reponse.icone} echelle={respire} />
          <span style={{ ...styleCorps(C, NUANCES.encreDouce) }}>Que puis-je préparer pour vous ?</span>
        </div>
      ) : null}

      {/* Bulle de l'utilisateur : naît du champ et monte à sa place. */}
      {envoye ? (
        <div style={{ position: "absolute", right: 0, top: 0, display: "flex", alignItems: "flex-end", gap: C * 0.45, transform: `translateY(${(1 - monte) * yChampAvant}px)`, opacity: fondu(p.t, ra) }}>
          <span style={{ ...styleCorps(TYPO.minimum(W), NUANCES.sableProfond), fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", opacity: fondu(p.t, ra + 0.15) }}>09:41</span>
          <div style={{ position: "relative", width: largeurBulle, padding: `${padY}px ${padX}px`, boxSizing: "border-box", background: degradeEncre, borderRadius: `${C * 0.8}px ${C * 0.8}px ${C * 0.25}px ${C * 0.8}px`, boxShadow: microOmbre(W) }}>
            <Reflet rayon={C * 0.8} />
            {lignesMessage.map((l, i) => (
              <div key={i} style={{ ...styleCorps(C, NUANCES.ivoire), lineHeight: `${lh}px`, whiteSpace: "nowrap" }}>{l}</div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Réponse : avatar, trois points, puis les vraies lignes. */}
      {p.t >= debutPoints ? (
        <div style={{ position: "absolute", left: 0, top: yReponse, display: "flex", alignItems: "flex-start", gap: C * 0.5, opacity: fondu(p.t, debutPoints), transform: `translateY(${(1 - glisse(p.t, debutPoints, 0.18)) * W * 0.02}px)` }}>
          <Avatar W={W} taille={avatar} icone={p.reponse.icone} echelle={respire} />
          <div style={{ position: "relative", padding: `${padY}px ${padX}px`, background: NUANCES.ivoire, border: `${filet}px solid ${NUANCES.filet}`, borderRadius: `${C * 0.25}px ${C * 0.8}px ${C * 0.8}px ${C * 0.8}px`, boxShadow: microOmbre(W), minHeight: lh }}>
            {p.t < debutTexte ? (
              <div style={{ height: lh, display: "flex", alignItems: "center", gap: C * 0.28 }}>
                {[0, 1, 2].map((k) => {
                  const saut = Math.max(0, Math.sin((p.t - debutPoints) * Math.PI * 4 - k * 0.9));
                  return <div key={k} style={{ width: C * 0.32, height: C * 0.32, borderRadius: "50%", background: NUANCES.sableProfond, transform: `translateY(${-saut * C * 0.22}px)`, opacity: 0.55 + 0.45 * saut }} />;
                })}
              </div>
            ) : (
              lignesReponse.map((l, i) => {
                const d = debutTexte + i * 0.08;
                return (
                  <div key={i} style={{ ...styleCorps(C, i === 0 ? NUANCES.encre : NUANCES.encreDouce), lineHeight: `${lh}px`, whiteSpace: "nowrap", opacity: fondu(p.t, d), transform: `translateY(${(1 - glisse(p.t, d, 0.16)) * C * 0.4}px)` }}>
                    {p.t >= d ? l : " "}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {/* Suggestions : pilules à filet, jamais coupées (2 rangées si besoin), cascade de 50 ms. */}
      {rangees.map((r, k) => (
        <div key={k} style={{ position: "absolute", left: 0, top: yPuces + k * (hPuce + ecartPuce), height: hPuce, display: "flex", gap: ecartPuce }}>
          {r.map((i) => {
            const pu = p.puces[i];
            const memes = p.puces.filter((x, j) => j < i && Math.abs(x.a - pu.a) < 1e-6).length;
            const a = pu.a + memes * 0.05;
            if (p.t < a) return <div key={i} style={{ width: largeursPuces[i] }} />;
            const g = pose(p.t, a, 0.2);
            const neuve = p.t < a + 0.35;
            return (
              <div key={i} style={{ position: "relative", height: hPuce, width: largeursPuces[i], boxSizing: "border-box", display: "flex", alignItems: "center", gap: Cp * 0.3, padding: `0 ${padPuce}px`, borderRadius: hPuce / 2, background: neuve ? NUANCES.orangeVoile : NUANCES.ivoire, border: `${filet}px solid ${neuve ? NUANCES.orange : NUANCES.filet}`, boxShadow: microOmbre(W, 0.7), transform: `translateX(${(1 - g) * -W * 0.025}px)`, opacity: fondu(p.t, a) }}>
                <Icone nom={pu.icone ?? "coche"} taille={icone} couleur={NUANCES.orange} epaisseur={2.4} />
                <span style={{ ...styleCorps(Cp, NUANCES.encre), whiteSpace: "nowrap" }}>{pu.texte}</span>
              </div>
            );
          })}
        </div>
      ))}

      {/* Champ de saisie en creux + bouton d'envoi (héros). */}
      {p.t >= p.message.a ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: yChampVu, height: hChamp, display: "flex", alignItems: "center", gap: C * 0.5, padding: `0 ${hChamp * 0.14}px 0 ${C * 0.7}px`, boxSizing: "border-box", borderRadius: hChamp / 2, background: NUANCES.ivoireCreux, boxShadow: ombreCreux(W), border: `${filet}px solid ${NUANCES.filet}`, transform: `translateY(${(1 - eChamp) * W * 0.03}px)`, opacity: fondu(p.t, p.message.a) }}>
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden", display: "flex", justifyContent: deborde ? "flex-end" : "flex-start", alignItems: "center" }}>
            <span style={{ ...styleCorps(C, texteChamp ? NUANCES.encre : NUANCES.sableProfond), whiteSpace: "nowrap" }}>{texteChamp || (envoye || p.t < f.debut ? p.indication ?? "Écrivez votre demande…" : "")}</span>
            {curseurVisible ? <span style={{ display: "inline-block", flexShrink: 0, width: 2, height: C * 1.15, marginLeft: 3, background: NUANCES.orange, order: texteChamp ? 1 : -1 }} /> : null}
          </div>
          <div style={{ width: hChamp * 0.72, height: hChamp * 0.72, flexShrink: 0, ...styleHeros(W, degradeOrange, hChamp), display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${ecrase})` }}>
            <Reflet rayon={hChamp * 0.36} inset={hChamp * 0.06} />
            <Icone nom="envoyer" taille={W * 0.04} couleur={NUANCES.ivoire} epaisseur={2.4} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Avatar({ W, taille, icone, echelle }: { W: number; taille: number; icone?: string; echelle: number }) {
  return (
    <div style={{ position: "relative", width: taille, height: taille, flexShrink: 0, borderRadius: "50%", background: degradeEncre, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: microOmbre(W, 0.8), overflow: "hidden" }}>
      <Reflet rayon={taille / 2} inset={taille * 0.1} />
      <div style={{ transform: `scale(${echelle})`, display: "flex" }}>
        <Icone nom={icone ?? "etincelles"} taille={W * 0.032} couleur={NUANCES.orangeVoile} epaisseur={2.2} />
      </div>
    </div>
  );
}

/** Police du corps exportée pour les contrôles (aucun texte sous 0,024 L). */
export const POLICE_CHAT = POLICES.texte;

/** Exemple pour la galerie (contenu Axion-IA plausible, aucun chiffre). Instants relatifs au début de la carte. */
export const EXEMPLE_CHAT_TAPE = {
  titre: "Claude · rédaction",
  phrase: "Je lui demande d'écrire le script, l'e-mail et la page : en quelques secondes, j'ai mes scripts, mes e-mails, mes pages.",
  indication: "Écrivez ici…",
  message: { texte: "Rédigez le script, l'e-mail d'invitation et la page.", a: 0.25 },
  reponse: { a: 1.9, lignes: 2, icone: "etincelles" },
  puces: [
    { texte: "Scripts", icone: "crayon", a: 2.75 },
    { texte: "E-mails", icone: "mail", a: 3.3 },
    { texte: "Pages de vente", icone: "document", a: 3.9 },
  ],
} satisfies Omit<ChatTapeProps, "t" | "largeurImage" | "hauteurLigne"> & { titre: string; phrase: string };
