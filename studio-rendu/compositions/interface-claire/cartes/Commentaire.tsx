import React from "react";
/**
 * CARTE « FIL DE COMMENTAIRES » (redessinée le 15/10/2026, designer n° 3 — standard premium). Fausse publication
 * générique : aucun logo de réseau réel, aucune personne réelle.
 *
 * Référence (planche_12, 1,75 → 3,75 s) : le mot-clé se tape dans le champ, part dans le fil, puis une notification
 * sombre « Nouveau message » surgit.
 * Composition (hiérarchie publication → commentaire → notification, plus d'autocollants) :
 *  - publication : avatar à monogramme, nom en titre, « il y a 2 h » en sable-profond, texte en corps sur 2 lignes,
 *    barre d'actions à icônes nues ;
 *  - commentaire publié (en réponse, décalé) : « Vous · à l'instant » en corps, le mot saisi en titre ORANGE, cœur et
 *    compteur ; avant lui, une invite « Soyez le premier à commenter » tient la place ;
 *  - champ en creux (ombre intérieure, curseur orange) + bouton « Publier » : SEUL héros (contour + ombre dure) ;
 *  - notification : bannière système encre avec reflet, qui descend du haut par-dessus le fil.
 * Mouvement : frappe lettre à lettre (curseur fixe pendant la frappe, clignotant à 2 Hz à l'arrêt) ; le bouton
 * s'écrase de 8 % ; le commentaire NAÎT du champ sur un flash orange et glisse vers le haut (0,2 s, étirement 5 %) ; le cœur claque à 130 %
 * puis se pose, le compteur roule de 0 à 1 ; la bannière descend en glisse et le fil encaisse un suivi de 2 % ;
 * N3 : point « non lu » qui respire, curseur.
 * Props, exports et `hauteurCommentaire` INCHANGÉS (plans, `VideoAnimee.tsx`, `cadrage.ts`).
 */
import { Icone } from "../elements";
import { bosse, ChiffreRoulant, claque, Coeur, DEGRADE, encreA, filet, fondu, glisse, ivoireA, microOmbre, N3, Reflet, respire, styleCorps, styleHeros, styleTitre, typo } from "../variantes/premium-3";

export type CommentaireProps = {
  /** Temps courant (secondes). */
  t: number;
  largeurImage: number;
  /** Largeur disponible dans la carte (px). */
  largeur: number;
  /** Unité de base (px) : la hauteur du composant en dépend (`hauteurCommentaire`). */
  taille: number;
  /** Publication commentée (auteur générique, jamais une personne réelle). Absente : seul le fil est montré. */
  publication?: { auteur: string; texte: string; a: number };
  /** Champ de saisie : apparaît à `a` avec son texte d'invite. */
  champ: { indication: string; a: number };
  /** Mot-clé tapé lettre à lettre, de `debut` à `fin` (s). */
  saisie: { texte: string; debut: number; fin: number };
  /** Bouton d'envoi : texte (« Publier ») et instant (s) où il s'enfonce. */
  bouton: { texte: string; a: number };
  /** Commentaire publié dans le fil à `a` ; le cœur se remplit à `jaimeA`. */
  commentaire: { auteur: string; a: number; jaimeA?: number };
  /** Notification qui descend du haut. */
  notification?: { titre: string; texte: string; a: number };
};

const H_PUBLICATION = 1.9;
const H_FIL = 1.25;
const H_CHAMP = 0.95;
const ECART = 0.2;

/** Hauteur occupée par le composant (px), pour dimensionner la `<Carte>` (formule inchangée : la mise en page en dépend). */
export function hauteurCommentaire(taille: number, avecPublication = true) {
  return taille * ((avecPublication ? H_PUBLICATION + ECART : 0) + H_FIL + ECART + H_CHAMP + 0.15);
}

const initiale = (nom: string) => Array.from(nom.trim())[0]?.toUpperCase() ?? "";

export function Commentaire(p: CommentaireProps) {
  const W = p.largeurImage;
  const t = p.t;
  const T = p.taille;
  const L = p.largeur;
  const ty = typo(W);
  const pub = p.publication;
  const hTotal = hauteurCommentaire(T, !!pub);

  // Grille verticale (somme = hauteurCommentaire) : publication, fil, champ.
  const hPub = pub ? T * 2.05 : 0;
  const ySlot = pub ? hPub + T * 0.1 : 0;
  const hSlot = T * (pub ? 1.15 : 1.25);
  const hChamp = Math.round(Math.min(T * 0.82, W * 0.075));
  const yChamp = hTotal - T * 0.15 - hChamp;
  const avatar = Math.round(W * 0.068);
  const retrait = avatar + Math.round(W * 0.02);

  // Saisie.
  const lettres = Array.from(p.saisie.texte);
  const duree = Math.max(0.01, p.saisie.fin - p.saisie.debut);
  const tapees = t < p.saisie.debut ? 0 : Math.min(lettres.length, Math.floor(((t - p.saisie.debut) / duree) * lettres.length) + 1);
  const envoye = t >= p.bouton.a + 0.08;
  const enSaisie = t >= p.saisie.debut && t < p.saisie.fin + 0.1;
  const curseur = t >= p.champ.a && !envoye && (enSaisie || Math.floor((t - p.champ.a) / 0.25) % 2 === 0);

  // Bouton : s'écrase (8 %) en 0,05 s, se relève en 0,12 s.
  const enfonce = t < p.bouton.a ? 0 : t < p.bouton.a + 0.05 ? (t - p.bouton.a) / 0.05 : Math.max(0, 1 - (t - p.bouton.a - 0.05) / 0.12);
  const eChamp = glisse(t, p.champ.a, 0.2);

  // Commentaire : naît du champ et monte à sa place.
  const c = p.commentaire;
  const eCom = glisse(t, c.a, 0.2);
  const enVol = t >= c.a && t < c.a + 0.2;
  const jaime = c.jaimeA !== undefined && t >= c.jaimeA;
  const eCoeur = jaime ? 1 + 0.3 * (1 - claque(t, c.jaimeA! + 0.04, 0.16)) : 1;
  const surligne = t >= c.a ? Math.max(0, 1 - Math.max(0, t - c.a - 0.35) / 0.3) : 0;
  // Le commentaire naît sur un flash orange plein (le temps de son vol, 0,2 s), puis garde un voile orange qui s'efface.
  const flashCom = t >= c.a && t < c.a + 0.2;

  const n = p.notification;
  const eN = n ? glisse(t, n.a, 0.2) : 0;
  const suivi = n ? 0.02 * hTotal * bosse(t, n.a + 0.12, 0.16) : 0;
  const hBanniere = Math.round(Math.max(W * 0.115, ty.titre * 1.15 + ty.corps * 1.3 + W * 0.03));

  return (
    <div style={{ position: "relative", width: L, height: hTotal }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: L, height: hTotal, transform: `translateY(${suivi}px)` }}>
        {/* Publication d'origine. */}
        {pub && t >= pub.a ? (
          <div style={{ position: "absolute", left: 0, top: 0, width: L, height: hPub, opacity: fondu(t, pub.a), transform: `translateY(${(1 - glisse(t, pub.a, 0.2)) * W * 0.03}px)` }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: avatar, height: avatar, borderRadius: "50%", background: DEGRADE.orange, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: microOmbre(W) }}>
              <Reflet rayon={avatar} retrait={avatar * 0.22} />
              <span style={{ ...styleTitre(Math.round(W * 0.034), N3.ivoire), letterSpacing: 0 }}>{initiale(pub.auteur)}</span>
            </div>
            <div style={{ position: "absolute", left: retrait, right: 0, top: 0, display: "flex", flexDirection: "column", gap: Math.round(W * 0.006) }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: Math.round(W * 0.014), whiteSpace: "nowrap", height: Math.round(ty.titre * 1.15) }}>
                <span style={{ ...styleTitre(ty.titre, N3.encre) }}>{pub.auteur}</span>
                <span style={{ ...styleCorps(ty.corps, N3.sableProfond) }}>· il y a 2 h</span>
              </div>
              <div style={{ ...styleCorps(ty.corps, N3.encre), display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", opacity: fondu(t, pub.a + 0.05), transform: `translateY(${(1 - glisse(t, pub.a + 0.05, 0.2)) * W * 0.02}px)` }}>{pub.texte}</div>
            </div>
            {/* Barre d'actions : icônes nues, sur un filet. */}
            <div style={{ position: "absolute", left: retrait, right: 0, bottom: 0, height: Math.round(W * 0.047), borderTop: filet(W), display: "flex", alignItems: "flex-end", gap: Math.round(W * 0.05), opacity: fondu(t, pub.a + 0.1) }}>
              {["coeur", "message", "partage"].map((nom) => (
                <Icone key={nom} nom={nom} taille={W * 0.04} couleur={N3.sableProfond} epaisseur={2.2} />
              ))}
            </div>
          </div>
        ) : null}

        {/* Fil : invite, puis commentaire publié (réponse décalée). */}
        {t < c.a && t >= (pub ? pub.a : p.champ.a) ? (
          <div style={{ position: "absolute", left: pub ? retrait : 0, right: 0, top: ySlot, height: hSlot, display: "flex", alignItems: "center", gap: Math.round(W * 0.016), opacity: fondu(t, (pub ? pub.a : p.champ.a) + 0.1) }}>
            <Icone nom="message" taille={W * 0.04} couleur={N3.sable} epaisseur={2.2} />
            <span style={{ ...styleCorps(ty.corps, N3.sableProfond) }}>Soyez le premier à commenter</span>
          </div>
        ) : null}
        {t >= c.a ? (
          <div
            style={{
              position: "absolute",
              left: pub ? retrait - Math.round(W * 0.016) : 0,
              right: 0,
              top: ySlot,
              height: hSlot,
              borderRadius: Math.round(W * 0.014),
              background: flashCom ? DEGRADE.orange : surligne > 0 ? `rgba(222, 192, 168, ${surligne})` : "transparent",
              display: "flex",
              alignItems: "center",
              gap: Math.round(W * 0.016),
              padding: `0 ${Math.round(W * 0.016)}px`,
              boxSizing: "border-box",
              transform: `translateY(${(1 - eCom) * (yChamp - ySlot)}px) scaleY(${enVol ? 1.05 : 1})`,
              opacity: fondu(t, c.a),
            }}
          >
            <div style={{ width: Math.round(W * 0.055), height: Math.round(W * 0.055), flexShrink: 0, borderRadius: "50%", background: DEGRADE.encre, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <Reflet rayon={40} retrait={10} />
              <span style={{ ...styleTitre(Math.round(W * 0.026), N3.ivoire), letterSpacing: 0 }}>{initiale(c.auteur)}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: Math.round(W * 0.002) }}>
              <span style={{ ...styleCorps(ty.corps, flashCom ? N3.ivoire : N3.sableProfond), lineHeight: 1.1, whiteSpace: "nowrap" }}>{c.auteur} · à l'instant</span>
              <span style={{ ...styleTitre(ty.titre, flashCom ? N3.ivoire : N3.orange), whiteSpace: "nowrap" }}>{p.saisie.texte}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: Math.round(W * 0.008) }}>
              <div style={{ transform: `scale(${eCoeur})`, display: "flex" }}>
                <Coeur taille={W * 0.04} plein={jaime} couleur={flashCom ? N3.ivoire : jaime ? N3.orange : N3.sableProfond} />
              </div>
              <ChiffreRoulant valeur={jaime ? glisse(t, c.jaimeA! + 0.04, 0.2) : 0} taille={ty.corps} couleur={flashCom ? N3.ivoire : jaime ? N3.orange : N3.sableProfond} chiffres={1} />
            </div>
          </div>
        ) : null}

        {/* Champ en creux + bouton héros. */}
        {t >= p.champ.a ? (
          <div style={{ position: "absolute", left: 0, top: yChamp, width: L, height: hChamp, display: "flex", gap: Math.round(W * 0.016), alignItems: "center", opacity: fondu(t, p.champ.a), transform: `translateY(${(1 - eChamp) * W * 0.03}px)` }}>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                height: hChamp,
                borderRadius: hChamp / 2,
                background: N3.ivoireCreux,
                border: filet(W),
                boxSizing: "border-box",
                boxShadow: `inset 0 ${Math.round(W * 0.003)}px ${Math.round(W * 0.006)}px ${encreA(0.1)}`,
                display: "flex",
                alignItems: "center",
                padding: `0 ${Math.round(W * 0.028)}px`,
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              {tapees > 0 && !envoye ? <span style={{ ...styleCorps(Math.round(W * 0.03), N3.encre), whiteSpace: "pre" }}>{lettres.slice(0, tapees).join("")}</span> : null}
              {curseur ? <span style={{ display: "inline-block", width: Math.max(3, Math.round(W * 0.0028)), height: Math.round(W * 0.038), marginLeft: tapees > 0 && !envoye ? 3 : 0, marginRight: tapees > 0 && !envoye ? 0 : Math.round(W * 0.008), background: N3.orange, borderRadius: 2 }} /> : null}
              {tapees === 0 || envoye ? <span style={{ ...styleCorps(ty.corps, N3.sableProfond), overflow: "hidden", textOverflow: "ellipsis" }}>{p.champ.indication}</span> : null}
            </div>
            <div
              style={{
                position: "relative",
                height: hChamp,
                ...styleHeros(W, DEGRADE.orange, hChamp / 2, enfonce),
                display: "flex",
                alignItems: "center",
                gap: Math.round(W * 0.01),
                padding: `0 ${Math.round(W * 0.026)}px`,
                transform: `translate(${Math.round(W * 0.005) * enfonce}px, ${Math.round(W * 0.005) * enfonce}px) scale(${1 - 0.08 * enfonce})`,
              }}
            >
              <Reflet rayon={hChamp / 2} retrait={hChamp * 0.3} />
              <span style={{ ...styleCorps(Math.round(W * 0.03), N3.ivoire), whiteSpace: "nowrap" }}>{p.bouton.texte}</span>
              <Icone nom="envoyer" taille={W * 0.04} couleur={N3.ivoire} epaisseur={2.4} />
            </div>
          </div>
        ) : null}
      </div>

      {/* Notification système : descend du haut (couche découpée au haut du composant), par-dessus le fil. */}
      {n && t >= n.a ? (
        <div style={{ position: "absolute", left: -Math.round(W * 0.01), right: -Math.round(W * 0.01), top: 0, height: hBanniere + W * 0.03, overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              left: Math.round(W * 0.01),
              right: Math.round(W * 0.01),
              top: 0,
              height: hBanniere,
              borderRadius: Math.round(W * 0.018),
              background: DEGRADE.encre,
              boxShadow: `0 ${Math.round(W * 0.006)}px ${Math.round(W * 0.012)}px ${encreA(0.22)}`,
              display: "flex",
              alignItems: "center",
              gap: Math.round(W * 0.02),
              padding: `0 ${Math.round(W * 0.022)}px`,
              boxSizing: "border-box",
              transform: `translateY(${-(1 - eN) * (hBanniere + W * 0.02)}px)`,
            }}
          >
            <Reflet rayon={10} retrait={14} />
            <div style={{ position: "relative", width: Math.round(W * 0.075), height: Math.round(W * 0.075), flexShrink: 0, borderRadius: Math.round(W * 0.018), background: DEGRADE.orange, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Reflet rayon={8} retrait={8} />
              <div style={{ transform: `rotate(${Math.sin(Math.max(0, t - n.a - 0.15) * 28) * 12 * Math.max(0, 1 - (t - n.a - 0.15) / 0.45)}deg)`, transformOrigin: "50% 15%", display: "flex" }}>
                <Icone nom="cloche" taille={W * 0.04} couleur={N3.ivoire} epaisseur={2.4} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: Math.round(W * 0.004) }}>
              <span style={{ ...styleTitre(ty.titre, N3.ivoire), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.titre}</span>
              <span style={{ ...styleCorps(ty.corps, N3.sableClair), whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", opacity: fondu(t, n.a + 0.05) }}>{n.texte}</span>
            </div>
            <div style={{ width: Math.round(W * 0.016), height: Math.round(W * 0.016), flexShrink: 0, borderRadius: "50%", background: N3.orangeChaud, boxShadow: `0 0 0 ${Math.round(W * 0.007 * respire(t, 1.0))}px ${ivoireA(0.14)}` }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Données d'exemple pour la galerie (auteur générique « Axion-IA », lecteur « Vous », mot-clé GUIDE). */
export const EXEMPLE_COMMENTAIRE: Omit<CommentaireProps, "t" | "largeurImage" | "largeur" | "taille"> = {
  publication: { auteur: "Axion-IA", texte: "Commentez GUIDE et recevez notre guide pour démarrer avec l'IA dans votre entreprise.", a: 0.2 },
  champ: { indication: "Ajouter un commentaire…", a: 0.5 },
  saisie: { texte: "GUIDE", debut: 0.8, fin: 1.3 },
  bouton: { texte: "Publier", a: 1.5 },
  commentaire: { auteur: "Vous", a: 1.6, jaimeA: 2.0 },
  notification: { titre: "Nouveau message", texte: "Votre guide « Démarrer avec l'IA » + les liens", a: 2.4 },
};
