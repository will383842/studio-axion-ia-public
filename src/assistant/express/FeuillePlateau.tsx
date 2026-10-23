"use client";

/**
 * Bloc PLATEAU de l'écran « Votre vidéo » (lot M3 ; plan PARTIE A §2 étape 2 et §3, B.3, catalogue des décors).
 * Une grande image de vous dans le décor choisi (gratuite, instantanée), puis : Décors · Tenues · Assis / Debout,
 * l'interrupteur Micro, et « Décrivez » (« bureau, costume bleu, debout ») traduit en pastilles à vérifier.
 * Rien n'est jamais lancé sans votre accord.
 */
import Image from "next/image";
import { useState } from "react";
import { creerDecorDecritAction, estimerDecorDecritAction, pastillesPlateauAction } from "@/app/(studio)/nouvelle/[format]/actions";
import { confirmerPrix } from "@/components/ui/ConfirmationPrix";
import { ApercuPlateau } from "@/components/creation/ApercuPlateau";
import { Bouton } from "@/components/ui/Bouton";
import { Champ } from "@/components/ui/Champ";
import { Icone } from "@/components/ui/Icone";
import { Interrupteur } from "@/components/ui/Interrupteur";
import { Pastille } from "@/components/ui/Pastille";
import { notifier } from "@/components/ui/Toast";
import { decorAVerifier, methodeDecor, ordonnerDecors } from "@/domaine/decors";
import { anglePrincipalDe, postureDe, tenueDe } from "@/domaine/distribution";
import type { PostureVisage, ValeurDecor } from "@/domaine/types";
import { obtenirFormat } from "@/formats";
import type { PastilleDistribution } from "@/fournisseurs";
import { formaterMontant } from "@/lib/montants";
import { cn } from "@/lib/cn";
import type { VueElement } from "@/services/vues";
import { AjoutezVousDabord, EtapeDistribution } from "../etapes/Distribution";
import type { ProprietesEtape } from "../etapes/types";
import { etatAngles, libellePastille, visagePour } from "./logique";
import { ID_MICRO, idDecorDe, imageDecor, microAllume, proprietesPlateau } from "./plateau";

export function FeuillePlateau(props: ProprietesEtape) {
  const { brouillon, modifier, contexte } = props;
  const [reserve, setReserve] = useState(false);
  const decors = ordonnerDecors(contexte.elements);
  const decorChoisi = idDecorDe(brouillon, contexte.elements);
  const d = brouillon.distribution[0];
  const personnage = contexte.personnages.find((p) => p.personnage.id === d?.personnageId);
  const principal = personnage?.visages.find((v) => v.id === d?.visageId);
  const angles = etatAngles(personnage?.visages ?? [], principal, brouillon.reglages, d?.visagesParAngle);
  const silhouette = principal ? (contexte.express?.plateau.detoures[principal.id] ?? null) : null;
  const micro = microAllume(brouillon);

  const choisirDecor = (id: string) => modifier({ styles: { ...brouillon.styles, decorId: id } });
  const basculerMicro = (v: boolean) => {
    const autres = (brouillon.styles.accessoireIds ?? []).filter((x) => x !== ID_MICRO);
    modifier({ reglages: { ...brouillon.reglages, micro: v }, styles: { ...brouillon.styles, accessoireIds: v ? [...autres, ID_MICRO] : autres } });
  };

  return (
    <div className="space-y-6">
      {/* TEST-UI-REEL U4 : sans personnage, l'invitation à s'ajouter vient en premier. */}
      {contexte.personnages.length === 0 && <AjoutezVousDabord />}
      <div>
        <ApercuPlateau {...proprietesPlateau(brouillon, contexte)} />
        {angles.mention && (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-texte-faible">
            <Icone nom="camera" size={13} />
            {angles.mention}
          </p>
        )}
      </div>

      <section>
        <p className="mb-2 text-sm font-semibold text-texte-doux">Décors</p>
        <ListeDecors decors={decors.proposes} choisi={decorChoisi} silhouette={silhouette} contexte={contexte} onChoisir={choisirDecor} />
        {decors.reserve.length > 0 && (
          <>
            <Bouton variante="fantome" icone={reserve ? "chevron-bas" : "plus"} className="-ml-2 mt-1" onClick={() => setReserve((r) => !r)}>
              {reserve ? "Moins de décors" : "Plus de décors"}
            </Bouton>
            {reserve && <ListeDecors decors={decors.reserve} choisi={decorChoisi} silhouette={silhouette} contexte={contexte} onChoisir={choisirDecor} />}
          </>
        )}
      </section>

      {contexte.personnages.length > 0 && <EtapeDistribution {...props} compacte />}

      <Interrupteur icone="micro" libelle="Micro" detail={micro ? "Du côté où vous regardez, flou" : undefined} coche={micro} onChange={basculerMicro} className="rounded-carte border border-trait bg-surface-1 px-3" />

      <Decrivez {...props} />
    </div>
  );
}

function ListeDecors({ decors, choisi, silhouette, contexte, onChoisir }: { decors: VueElement[]; choisi?: string; silhouette: string | null; contexte: ProprietesEtape["contexte"]; onChoisir: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Décor" className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {decors.map((e) => {
        const v = e.valeur as ValeurDecor;
        const actif = e.id === choisi;
        const image = e.vignette ?? imageDecor(e, contexte);
        const look = methodeDecor(v) === "look-heygen";
        return (
          <button
            key={e.id}
            type="button"
            role="radio"
            aria-checked={actif}
            onClick={() => onChoisir(e.id)}
            className={cn("w-24 shrink-0 overflow-hidden rounded-xl border text-left transition-colors", actif ? "border-orange ring-2 ring-orange/40" : "border-trait hover:border-trait-fort")}
          >
            <span className="relative block aspect-[9/16]" style={{ background: v.teinte ?? "var(--surface-2)" }}>
              {image ? (
                <Image src={image} alt="" fill sizes="96px" className="object-cover" />
              ) : (
                <span className="absolute inset-0 grid place-items-center bg-linear-to-b from-surface-2 to-surface-3 text-texte-faible">
                  <Icone nom="image" size={20} />
                </span>
              )}
              {/* La vignette montre le décor avec vous (gratuit pour les fonds neutres ; un Look est généré une fois). */}
              {silhouette && !look && <Image src={silhouette} alt="" fill sizes="96px" className="object-contain object-bottom" />}
              {v.catalogue?.misEnAvant && !actif && (
                <span className="absolute left-1 top-1">
                  <Pastille ton="orange" icone="etoile">
                    Conseillé
                  </Pastille>
                </span>
              )}
              {decorAVerifier(v) && (
                <span className="absolute inset-x-1 bottom-1">
                  <Pastille ton="ambre">À vérifier</Pastille>
                </span>
              )}
              {actif && (
                <span className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-orange text-sur-orange">
                  <Icone nom="coche" size={13} strokeWidth={3} />
                </span>
              )}
            </span>
            <span className="block truncate px-2 py-1.5 text-xs font-semibold text-texte">{e.nom}</span>
          </button>
        );
      })}
    </div>
  );
}


/** « Décrivez » : une phrase → pastilles { trouvé, à créer (prix, durée), pas encore filmé (repli) }. Une touche par pastille. */
function Decrivez({ brouillon, modifier, contexte }: ProprietesEtape) {
  const [phrase, setPhrase] = useState("");
  const [pastilles, setPastilles] = useState<PastilleDistribution[] | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [deuxAngles, setDeuxAngles] = useState(false);
  const d = brouillon.distribution[0];
  const personnage = contexte.personnages.find((p) => p.personnage.id === d?.personnageId);

  async function traduire() {
    setOccupe(true);
    const r = await pastillesPlateauAction(d?.personnageId, phrase);
    setOccupe(false);
    if (!r.ok) return notifier.erreur(r.message);
    setPastilles(r.donnees);
  }

  /**
   * Correcteur réel 2 (F2) : « Créer ce décor avec HeyGen » : votre avatar dans la pièce et la tenue décrites. Le prix
   * est montré dans la feuille « Confirmer ce prix » ; rien n'est créé sans votre accord.
   */
  async function creerAvecHeygen() {
    setOccupe(true);
    const e = await estimerDecorDecritAction(phrase, deuxAngles);
    setOccupe(false);
    if (!e.ok) return notifier.erreur(e.message);
    if (e.donnees.bloque) return notifier.info("Décor HeyGen", e.donnees.bloque);
    const n = e.donnees.angles.length;
    const accord = await confirmerPrix({ message: `Votre avatar dans « ${e.donnees.nom} » (${n} angle${n > 1 ? "s" : ""}).${e.donnees.prixAConfirmer ? ` ${e.donnees.prixAConfirmer}` : ""}${e.donnees.essai ? " Essai : rien n'est payé." : ""}`, montant: e.donnees.cout.centimes });
    if (accord === null) return;
    setOccupe(true);
    const r = await creerDecorDecritAction(phrase, deuxAngles, accord);
    setOccupe(false);
    if (!r.ok) return notifier.erreur(r.message);
    modifier({ styles: { ...brouillon.styles, decorId: r.donnees.decorId } });
    notifier.succes("Décor en création chez HeyGen", "Validez-le sur sa vignette (Bibliothèque, Décors) avant la vidéo.");
  }

  const appliquer = (p: PastilleDistribution) => {
    if (p.etat === "a-creer") {
      // Correcteur réel 2 (F2) : un décor ou une tenue à créer se fait avec HeyGen, prix confirmé d'abord.
      if (p.genre === "decor" || p.genre === "tenue") return void creerAvecHeygen();
      notifier.info(`${p.libelle} : à créer`, `≈ ${formaterMontant(p.coutEstime, { court: true })}, environ ${Math.max(1, Math.round(p.dureeEstimeeSec / 60))} min.`);
      return;
    }
    if (p.genre === "decor") return modifier({ styles: { ...brouillon.styles, decorId: p.id } });
    const visages = personnage?.visages ?? [];
    const actuel = visages.find((v) => v.id === d?.visageId);
    // Correcteur 4 : changer de tenue ou de posture garde le même avatar, à l'angle principal du format.
    const choixAvatar = { actuel, anglePrincipal: anglePrincipalDe(obtenirFormat(brouillon.formatId).recetteMontage) };
    if (p.genre === "posture") {
      const posture = p.etat === "trouve" ? (p.id as PostureVisage) : p.repli;
      const v = visagePour(visages, actuel ? tenueDe(actuel) : undefined, posture, choixAvatar) ?? visagePour(visages, undefined, posture, choixAvatar);
      return modifier(v ? { posture, distribution: brouillon.distribution.map((x, i) => (i === 0 ? { ...x, visageId: v.id, visagesParAngle: undefined } : x)) } : { posture });
    }
    const v = visagePour(visages, p.id, brouillon.posture ?? (actuel ? postureDe(actuel) : undefined), choixAvatar) ?? visagePour(visages, p.id, undefined, choixAvatar);
    if (v) modifier({ distribution: brouillon.distribution.map((x, i) => (i === 0 ? { ...x, visageId: v.id, visagesParAngle: undefined } : x)) });
  };

  return (
    <section className="rounded-carte border border-trait bg-surface-1 p-4">
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void traduire();
        }}
      >
        <Champ libelle="Décrivez" placeholder="bureau, costume bleu, debout" value={phrase} onChange={(e) => setPhrase(e.target.value)} className="min-w-0 flex-1" enterKeyHint="go" />
        <Bouton type="submit" variante="secondaire" icone="baguette" aria-label="Traduire en choix" chargement={occupe} disabled={phrase.trim().length < 3} />
      </form>
      {pastilles && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {pastilles.map((p, i) => (
            <li key={i}>
              <button type="button" onClick={() => appliquer(p)} className="min-h-11">
                <Pastille ton={p.etat === "trouve" ? "sauge" : "ambre"} taille="md">
                  {libellePastille(p)}
                </Pastille>
              </button>
            </li>
          ))}
          {!pastilles.length && <li className="text-sm text-texte-faible">Rien à changer.</li>}
        </ul>
      )}
      {pastilles?.some((p) => p.etat === "a-creer" && (p.genre === "decor" || p.genre === "tenue")) && (
        <div className="mt-3 grid gap-2">
          <Interrupteur icone="visage" libelle="Aussi un second angle" detail="Même pièce, caméra sur le côté, regard vers votre interlocuteur." coche={deuxAngles} onChange={setDeuxAngles} />
          <Bouton pleineLargeur variante="secondaire" icone="etincelles" chargement={occupe} onClick={() => void creerAvecHeygen()}>
            Créer ce décor avec HeyGen
          </Bouton>
        </div>
      )}
    </section>
  );
}
