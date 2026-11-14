"use client";

import Link from "next/link";
import { BoutonCopier } from "@/components/ui/BoutonCopier";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { cocherAvantDePublierAction, envoyerVersBufferAction, modifierTexteKitAction } from "@/app/(studio)/videos/actions";
import { programmerSujetAction } from "@/app/(studio)/mesures/actions";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { Pastille } from "@/components/ui/Pastille";
import { tonEtatAffiche } from "./ton-etat-affiche";
import { PastilleEssai } from "@/components/ui/PastilleEssai";
import { notifier } from "@/components/ui/Toast";
import { libelleComptes } from "@/domaine/comptes-envoi";
import { LIBELLES_ENVOI } from "@/domaine/libelles";
import { envoyerParOutilAction, marquerEnvoiVerifieAction, type ComplementLigne } from "@/services/a-publier-zernio";
import type { LigneAPublier, VueAPublier } from "@/services/a-publier";
import { actionPrincipale, barreSelection, blocPremierCommentaire, choixOutilPropose, etatPremierCommentaire, FIN_BUFFER, formatApercu, joursRestantsBrouillon, ligneCompteEtDate, mentionIAVisible, messageSucces, nomOutil, libelleEnvoiOutil, phraseBrouillonAProgrammer, phraseEchec, phraseEssais, type OutilAffiche } from "./finitions-envoi";
import { casesAChanger, rapportLecteur, regrouperParVideo, toutesCochees, type CarteVideo } from "./regrouper-a-publier";

/** Aucun orange dans « À publier » : l'ambre porte le « à faire ». Le mot reste écrit dans la pastille. */

/** Valeur d'un <input type="datetime-local"> (heure locale). */
function versLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function demainNeufHeures(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

const LIBELLES_CASES: Record<string, string> = { image: "Image", son: "Son", sousTitres: "Sous-titres", mentionIA: "Mention IA", droits: "Droits" };

/** Détail d'une vidéo : la carte (lecteur entier, case unique, un bouton par réseau prêt, détail replié). `retour` : la liste où revenir après un envoi réussi. */
export function LignesAPublier({ vue, retour, reseauOuvert, suivantes, complements, chargement, erreur }: { vue: VueAPublier; retour?: string; reseauOuvert?: string; suivantes?: Record<string, string | null>; complements?: Record<string, ComplementLigne>; chargement?: boolean; erreur?: string }) {
  const router = useRouter();
  const cartes = regrouperParVideo(vue.lignes);
  const [selection, setSelection] = useState<string[]>([]);
  const [groupe, demarrerGroupe] = useTransition();
  // Un seul outil d'abord : le nom vient du catalogue, via le complément de la première ligne (Buffer par défaut).
  const outilGeneral = nomOutil(Object.values(complements ?? {})[0]?.outil);
  if (chargement) return <p role="status" className="rounded-2xl border border-trait bg-surface-2 px-3 py-4 text-sm text-texte-doux">{LIBELLES_ENVOI.chargement}</p>;
  if (erreur !== undefined) return <p role="alert" className="rounded-2xl border border-brique/40 bg-brique-doux px-3 py-4 text-sm text-texte">{erreur || LIBELLES_ENVOI.erreur}</p>;
  if (!cartes.length) return <p role="status" className="rounded-2xl border border-trait bg-surface-2 px-3 py-4 text-sm text-texte-doux">{LIBELLES_ENVOI.vide}</p>;
  const lignesChoisies = vue.lignes.filter((l) => selection.includes(l.cle));
  const barre = barreSelection(lignesChoisies.map((l) => ({ reseau: l.reseau, accordTiktok: false })));
  const alterner = (cle: string, v: boolean) => setSelection((x) => (v ? [...new Set([...x, cle])] : x.filter((c) => c !== cle)));

  /** Validation groupée : un envoi par ligne, demain 9 h. Le TikTok n'est jamais envoyé sans son accord (il attend). */
  function validerGroupe() {
    demarrerGroupe(async () => {
      const iso = demainNeufHeures().toISOString();
      let faits = 0;
      for (const l of lignesChoisies) {
        if (l.reseau === "tiktok") continue;
        const r = await envoyerParOutilAction(l.videoId, l.reseau, iso, { outil: complements?.[l.cle]?.outil ?? "buffer", premierCommentaire: l.premierCommentaire ?? "", contenuIA: mentionIAVisible(l.reseau) && l.casesRequises.includes("mentionIA") });
        if (!r.ok) {
          notifier.erreur(r.message);
          break;
        }
        faits += r.donnees.nombre;
        if (r.donnees.problemes.length) {
          notifier.erreur(r.donnees.problemes[0]);
          break;
        }
      }
      setSelection([]);
      if (faits) toast.success(`${faits} ${faits > 1 ? "envois validés" : "envoi validé"}`, { description: LIBELLES_ENVOI.groupeConseil });
      router.refresh();
    });
  }
  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 rounded-2xl border border-trait bg-surface-2 px-3 py-2.5 text-sm text-texte-doux">
        {vue.envoiSimule ? (
          <>
            <PastilleEssai /> Essai : rien ne part vers {outilGeneral} tant que la publication n&apos;est pas reliée.
          </>
        ) : vue.modeBuffer === "programmer" ? (
          `Les envois sont programmés dans ${outilGeneral} à la date choisie.`
        ) : (
          `Brouillon dans ${outilGeneral} : rien ne part tant que vous ne l'avez pas programmé dans ${outilGeneral}.`
        )}
      </p>
      <ul className="space-y-4">
        {cartes.map((c) => (
          <CarteDeVideo key={`${c.videoId}:${reseauOuvert ?? ""}`} carte={c} envoiSimule={vue.envoiSimule} modeBuffer={vue.modeBuffer} retour={retour} reseauOuvert={reseauOuvert} suivantes={suivantes} complements={complements} selection={selection} alterner={alterner} />
        ))}
      </ul>
      {barre && (
        <div role="region" aria-label="Sélection" className="sticky bottom-0 z-10 space-y-1 rounded-t-2xl border border-trait bg-surface-1 p-3 shadow-lg">
          <Bouton taille="lg" pleineLargeur icone="envoyer" chargement={groupe} onClick={validerGroupe}>
            {barre.libelle}
          </Bouton>
          <p className="text-center text-xs text-texte-doux">{LIBELLES_ENVOI.groupeDate(new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(demainNeufHeures()))}</p>
          {barre.note && <p className="text-center text-xs text-texte-faible">{barre.note}</p>}
        </div>
      )}
    </div>
  );
}

function CarteDeVideo({ carte, envoiSimule, modeBuffer, retour, reseauOuvert, suivantes, complements, selection, alterner }: { carte: CarteVideo; envoiSimule: boolean; modeBuffer: VueAPublier["modeBuffer"]; retour?: string; reseauOuvert?: string; suivantes?: Record<string, string | null>; complements?: Record<string, ComplementLigne>; selection?: string[]; alterner?: (cle: string, v: boolean) => void }) {
  const router = useRouter();
  const [coches, setCoches] = useState<Record<string, boolean>>(carte.coches);
  const [ouvert, setOuvert] = useState<string | null>(carte.pretes.some((l) => l.reseau === reseauOuvert) ? (reseauOuvert ?? null) : null);
  const [enCours, demarrer] = useTransition();
  const [pourSujet, demarrerSujet] = useTransition();
  const toutOk = toutesCochees(carte.casesRequises, coches);
  const etats = [...carte.pretes, ...carte.pasPretes].flatMap((l) => (l.etat ? [{ cle: l.reseau, reseauNom: l.reseauNom, ...l.etat }] : []));

  /** Une ou plusieurs vérifications d'un coup : le serveur reçoit une écriture par case, comme avant. */
  function ecrire(cles: string[], v: boolean) {
    if (!cles.length) return;
    setCoches((c) => ({ ...c, ...Object.fromEntries(cles.map((k) => [k, v])) }));
    demarrer(async () => {
      for (const [i, cle] of cles.entries()) {
        const r = await cocherAvantDePublierAction(carte.videoId, cle as "image", v);
        if (!r.ok) {
          setCoches((c) => ({ ...c, ...Object.fromEntries(cles.slice(i).map((k) => [k, !v])) }));
          notifier.erreur(r.message);
          return;
        }
      }
    });
  }

  function programmerSujet() {
    if (!carte.sujetId) return;
    demarrerSujet(async () => {
      const r = await programmerSujetAction(carte.sujetId!);
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      const { programmees, ignorees, modeBuffer: mode } = r.donnees;
      if (programmees.length) notifier.succes(mode === "brouillon" ? `Brouillon dans Buffer · ${libelleComptes(programmees.length)}` : `Programmée sur ${libelleComptes(programmees.length)}`);
      if (ignorees.length) notifier.erreur(ignorees[0].message);
      if (programmees.length && retour) router.push(retour);
      else router.refresh();
    });
  }

  const ouverte = carte.pretes.find((l) => l.reseau === ouvert);
  // Image → vidéo : le fichier se télécharge, il ne part jamais d'ici.
  const seul = carte.pretes.some((l) => l.telechargementSeul);
  const reseauTelechargement = ouverte?.reseau ?? carte.pretes[0]?.reseau ?? carte.pasPretes[0]?.reseau;
  const lienTelechargement = `/api/telechargements/video?video=${encodeURIComponent(carte.videoId)}${reseauTelechargement ? `&reseau=${reseauTelechargement}` : ""}`;

  return (
    <li className="rounded-carte border border-l-[5px] border-trait border-l-fam-video bg-surface-1 p-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-fam-video-doux text-fam-video">
            <Icone nom="film" size={20} />
          </span>
          <span className="text-xs font-semibold text-texte-doux">Vidéo</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/videos/${carte.videoId}`} className="min-w-0 text-base font-semibold text-texte hover:underline">
            {carte.titre}
          </Link>
          {etats.map((e) => (
            <Pastille key={e.cle} ton={tonEtatAffiche(e.libelle, e.ton)}>
              {e.reseauNom} : {e.libelle}
            </Pastille>
          ))}
        </div>

        {carte.lecture ? (
          <video
            controls
            preload="none"
            poster={carte.jaquette ?? undefined}
            src={carte.lecture}
            style={{ aspectRatio: rapportLecteur(carte.dimensions) }}
            className="mx-auto max-h-[28rem] min-h-40 w-full max-w-sm rounded-xl bg-surface-2 object-contain"
          />
        ) : (
          <div className="mx-auto grid min-h-40 w-full max-w-sm place-items-center rounded-xl bg-surface-2 text-sm text-texte-faible">Pas de fichier</div>
        )}

        {carte.blocageVideo && <p className="text-sm text-texte-doux">{carte.blocageVideo}</p>}

        <div className="flex flex-wrap gap-2">
          <Bouton asChild variante="secondaire" icone="telecharger">
            <a href={lienTelechargement}>Télécharger</a>
          </Bouton>
          {seul && reseauTelechargement === "facebook" && (
            <Bouton asChild variante="secondaire" icone="telecharger">
              <a href={`${lienTelechargement}&fil=1`}>Télécharger pour le fil</a>
            </Bouton>
          )}
        </div>
        {seul && <p className="text-sm text-texte-doux">Cette vidéo se télécharge ; elle ne part pas d&apos;ici.</p>}

        {carte.pretes.length > 0 && !seul && (
          <>
            <label className="flex min-h-11 items-start gap-3 rounded-2xl border border-trait px-3 py-2.5 text-sm font-semibold text-texte">
              <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={toutOk} disabled={enCours} onChange={(e) => ecrire(casesAChanger(carte.casesRequises, coches, e.target.checked), e.target.checked)} />
              J&apos;ai regardé la vidéo, tout est en règle
            </label>

            <div role="group" aria-label="Réseaux prêts" className="flex flex-wrap gap-2">
              {carte.pretes.map((l) => (
                <button
                  key={l.reseau}
                  type="button"
                  aria-expanded={ouvert === l.reseau}
                  aria-controls={`reseau-${l.cle.replace(/\W/g, "-")}`}
                  onClick={() => setOuvert(ouvert === l.reseau ? null : l.reseau)}
                  className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${ouvert === l.reseau ? "border-accent bg-accent-doux text-texte" : "border-trait text-texte-doux hover:border-accent"}`}
                >
                  <LogoReseau reseau={l.reseau} taille="sm" />
                  {l.reseauNom}
                </button>
              ))}
            </div>

            {carte.pretes.map((l) => (
              <PanneauReseau
                key={l.cle}
                ligne={l}
                visible={ouverte?.reseau === l.reseau}
                coches={coches}
                casesRequises={carte.casesRequises}
                enCours={enCours}
                cocher={(cle, v) => ecrire([cle], v)}
                envoiSimule={envoiSimule}
                modeBuffer={modeBuffer}
                retour={retour}
                suivante={suivantes?.[l.reseau] ?? null}
                complement={complements?.[l.cle]}
                selectionnee={!!selection?.includes(l.cle)}
                alterner={alterner}
              />
            ))}

            {carte.sujetId && !carte.blocageVideo && (
              <div className="space-y-1">
                <Bouton variante="secondaire" icone="calendrier" disabled={envoiSimule} chargement={pourSujet} onClick={programmerSujet}>
                  {modeBuffer === "programmer" ? "Programmer le sujet" : "Mettre le sujet en brouillon"}
                </Bouton>
                <p className="text-xs text-texte-faible">
                  Envoie toutes les versions prêtes du sujet, chacune à son créneau, sans premier commentaire.
                  {modeBuffer === "programmer" ? "" : " En mode brouillon, rien n'est programmé : relisez et programmez dans Buffer."}
                </p>
              </div>
            )}
          </>
        )}

        {carte.pasPretes.length > 0 && (
          <details className="rounded-2xl border border-trait px-3 py-2 text-sm">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-texte-doux">
              {carte.pasPretes.length === 1 ? "1 réseau pas encore prêt" : `${carte.pasPretes.length} réseaux pas encore prêts`}
            </summary>
            <ul className="space-y-1 pb-2 text-texte-doux">
              {carte.pasPretes.map((p) => (
                <li key={p.reseau}>
                  <span className="font-semibold text-texte">{p.reseauNom}</span> : {p.raison}
                  {p.etat && (
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      <Pastille ton={tonEtatAffiche(p.etat.libelle, p.etat.ton)}>{p.etat.libelle}</Pastille>
                      {p.etat.lien && (
                        <a href={p.etat.lien} target="_blank" rel="noreferrer" className="font-semibold text-accent">
                          Voir la publication
                        </a>
                      )}
                      {p.etat.detail}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </li>
  );
}

function PanneauReseau({
  ligne: l,
  visible,
  coches,
  casesRequises,
  enCours: enCoursCases,
  cocher,
  envoiSimule,
  modeBuffer,
  retour,
  suivante,
  complement,
  selectionnee,
  alterner,
}: {
  ligne: LigneAPublier;
  visible: boolean;
  coches: Record<string, boolean>;
  casesRequises: LigneAPublier["casesRequises"];
  enCours: boolean;
  cocher: (cle: string, v: boolean) => void;
  envoiSimule: boolean;
  modeBuffer: VueAPublier["modeBuffer"];
  retour?: string;
  suivante?: string | null;
  complement?: ComplementLigne;
  selectionnee?: boolean;
  alterner?: (cle: string, v: boolean) => void;
}) {
  const router = useRouter();
  const [succes, setSucces] = useState<string | null>(null);
  const [texte, setTexte] = useState(l.texte);
  const [commentaire, setCommentaire] = useState(l.premierCommentaire ?? "");
  const [date, setDate] = useState(() => versLocal(demainNeufHeures()));
  const [comptes, setComptes] = useState<string[]>(l.compte.memorises ?? []);
  const [accordTiktok, setAccordTiktok] = useState(false);
  const [outilChoisi, setOutilChoisi] = useState<OutilAffiche | null>(null);
  const [enCours, demarrer] = useTransition();
  const modifie = texte !== l.texte;
  const manque = casesRequises.filter((c) => !coches[c]);
  const avecChoix = !!l.compte.choix?.length;
  // Par compte, comme le serveur : seuls les comptes cochés déjà pris bloquent ; les autres restent envoyables.
  const dejaPris = !!l.etat && (avecChoix ? l.etat.sansCompte || (comptes.length > 0 && comptes.every((c) => l.etat!.comptesPris.includes(c))) : l.etat.envoye);
  const raison =
    (avecChoix && !comptes.length ? "Cochez le compte où envoyer." : undefined) ??
    (modifie ? "Enregistrez le texte d'abord." : undefined) ??
    (manque.length ? "Cochez d'abord « J'ai regardé la vidéo, tout est en règle »." : undefined) ??
    (dejaPris ? (avecChoix ? `Déjà envoyée vers ${comptes.filter((c) => l.etat!.comptesPris.includes(c)).map((c) => l.compte.choix!.find((x) => x.id === c)?.nom ?? c).join(", ") || "ce réseau"}.` : "Déjà envoyée pour ce réseau.") : undefined);
  const peutEnvoyer = !raison && !envoiSimule;

  function enregistrerTexte() {
    demarrer(async () => {
      const r = await modifierTexteKitAction(l.videoId, l.reseau, texte, l.motsDiese, l.titreReseau);
      if (!r.ok) notifier.erreur(r.message);
      else {
        notifier.succes("Texte enregistré");
        router.refresh();
      }
    });
  }

  /** Écran selon l'outil : l'envoi passe par l'outil effectif de CE contenu (choix « Changer » compris). */
  function envoyerParOutil() {
    if (!complement) return;
    const outil: OutilAffiche = outilChoisi ?? complement.outil;
    setSucces(null);
    demarrer(async () => {
      const quand = new Date(date);
      if (!date || Number.isNaN(quand.getTime())) {
        notifier.erreur("Choisissez une date valide.");
        return;
      }
      const r = await envoyerParOutilAction(l.videoId, l.reseau, quand.toISOString(), { outil, ...(avecChoix ? { comptes } : {}), premierCommentaire: commentaire, accordTiktok, contenuIA: mentionIAVisible(l.reseau) && casesRequises.includes("mentionIA") });
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      if (r.donnees.problemes.length) notifier.erreur(r.donnees.problemes[0]);
      else setSucces(`Envoyé par ${nomOutil(outil)}.`);
      router.refresh();
    });
  }

  function brouillon() {
    setSucces(null);
    demarrer(async () => {
      const quand = new Date(date);
      if (!date || Number.isNaN(quand.getTime())) {
        notifier.erreur("Choisissez une date valide.");
        return;
      }
      const iso = quand.toISOString();
      const r = await envoyerVersBufferAction(l.videoId, [l.reseau], iso, false, avecChoix ? { [l.reseau]: comptes } : {}, { [l.reseau]: commentaire }, true);
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      const n = r.donnees.nombre;
      if (r.donnees.problemes.length) notifier.erreur(r.donnees.problemes[0]);
      if (r.donnees.commentairesALaMain.length) notifier.erreur("Le premier commentaire n'est pas transmis à ce réseau : posez-le à la main.");
      // Envoi réussi : un seul message annoncé (le bloc ci-dessous, pas de toast en plus) ; on reste sur la vidéo (et « Suivante » s'il reste une vidéo à traiter).
      if (n) setSucces(messageSucces(r.donnees.mode, n));
      router.refresh();
    });
  }

  return (
    <div id={`reseau-${l.cle.replace(/\W/g, "-")}`} hidden={!visible} className="space-y-3 rounded-2xl bg-surface-2 p-3">
      {complement ? (
        <DetailEnvoi
          ligne={l}
          complement={complement}
          texte={texte}
          commentaire={commentaire}
          date={date}
          raison={raison}
          occupe={enCours || enCoursCases}
          envoiSimule={envoiSimule}
          accordTiktok={accordTiktok}
          setAccordTiktok={setAccordTiktok}
          outil={outilChoisi ?? complement.outil}
          setOutil={setOutilChoisi}
          envoyer={envoyerParOutil}
          succes={succes}
          suivante={suivante}
          selectionnee={!!selectionnee}
          alterner={alterner}
        />
      ) : (
        <>
      {l.etat && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-texte-doux">
          <Pastille ton={tonEtatAffiche(l.etat.libelle, l.etat.ton)}>{l.etat.libelle}</Pastille>
          {l.etat.lien && (
            <a href={l.etat.lien} target="_blank" rel="noreferrer" className="font-semibold text-accent">
              Voir la publication
            </a>
          )}
          {l.etat.detail}
        </p>
      )}

      <Bouton icone="envoyer" pleineLargeur disabled={!peutEnvoyer || enCoursCases} chargement={enCours} onClick={brouillon}>
        {libelleEnvoiOutil(modeBuffer)}
      </Bouton>
      <p className="text-sm text-texte-doux">{ligneCompteEtDate(avecChoix ? comptes.map((c) => l.compte.choix!.find((x) => x.id === c)?.nom ?? c) : l.compte.nom ? [l.compte.nom] : [], date, avecChoix)}</p>
      <BlocSucces succes={succes} suivante={suivante} />
      {raison && <p className="text-sm text-texte-doux">{raison}</p>}
        </>
      )}

      <details className="text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-accent">Voir le détail</summary>
        <div className="space-y-3 pt-2">
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-1 text-xs font-semibold text-texte-doux">Avant de publier</legend>
            {casesRequises.map((c) => (
              <label key={c} className="flex min-h-11 items-center gap-2 rounded-full border border-trait px-3 text-sm">
                <input type="checkbox" className="size-5" checked={!!coches[c]} disabled={enCoursCases} onChange={(e) => cocher(c, e.target.checked)} />
                {LIBELLES_CASES[c]}
              </label>
            ))}
          </fieldset>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-texte-doux">Phrase du post</span>
            <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={4} className="w-full rounded-champ border border-trait bg-surface-1 p-3 text-sm text-texte outline-none focus:border-accent" />
          </label>
          {modifie && (
            <Bouton variante="secondaire" icone="coche" chargement={enCours} onClick={enregistrerTexte}>
              Enregistrer le texte
            </Bouton>
          )}
          {l.motsDiese.length > 0 && <p className="text-xs text-texte-faible">{l.motsDiese.join(" ")}</p>}

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-texte-doux">Premier commentaire</span>
            <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={2} className="w-full rounded-champ border border-trait bg-surface-1 p-3 text-sm text-texte outline-none focus:border-accent" />
          </label>
          {commentaire.trim() && etatPremierCommentaire(outilChoisi ?? complement?.outil, l.reseau) === "a-la-main" && <p className="text-sm text-texte-doux">{l.reseauNom} ne reçoit pas le premier commentaire par {nomOutil(outilChoisi ?? complement?.outil)} : rien ne sera envoyé, posez-le à la main (bouton Copier dans l’aperçu).</p>}

          <div className="space-y-1">
            <span className="block text-xs font-semibold text-texte-doux">Compte Buffer</span>
            {l.compte.nom && <span className="text-texte">{l.compte.nom}</span>}
            {avecChoix && (
              <div className="flex flex-wrap gap-2">
                {l.compte.choix!.map((c) => (
                  <label key={c.id} className="flex min-h-11 items-center gap-2 rounded-full border border-trait px-3">
                    <input type="checkbox" className="size-5" checked={comptes.includes(c.id)} onChange={(e) => setComptes((x) => (e.target.checked ? [...x, c.id] : x.filter((i) => i !== c.id)))} />
                    {c.nom}
                  </label>
                ))}
              </div>
            )}
            {!l.compte.nom && !avecChoix && <span className="text-texte-faible">Lu au premier envoi.</span>}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-texte-doux">Date</span>
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="min-h-12 w-full rounded-champ border border-trait bg-surface-1 px-3.5 text-[15px] text-texte outline-none [color-scheme:light] focus:border-accent sm:w-auto" />
          </label>
        </div>
      </details>
    </div>
  );
}

/** Zone d'annonce toujours présente (pour que le lecteur d'écran l'annonce au remplissage) ; ne contient du texte qu'après un envoi réussi. */
export function BlocSucces({ succes, suivante }: { succes: string | null; suivante?: string | null }) {
  return (
    <div role="status" className={succes ? "space-y-2 rounded-2xl border border-sauge/40 bg-surface-1 p-3 text-sm font-semibold text-texte" : undefined}>
      {succes && <p>{succes}</p>}
      {succes && suivante && (
        <Bouton asChild variante="secondaire" pleineLargeur icone="envoyer">
          <Link href={suivante}>Suivante</Link>
        </Bouton>
      )}
    </div>
  );
}

const ETIQUETTES_ETAT = { aucun: "À envoyer", brouillon: "Brouillon", programmee: "Programmée", publiee: "Publiée", echec: "Échec" } as const;
const TONS_ETAT = { aucun: "neutre", brouillon: "neutre", programmee: "sauge", publiee: "contour", echec: "brique" } as const;

/** Détail d'une ligne : aperçu tel que publié, état, « Aussi sur », avertissements, UNE action principale, « Envoi par ». */
function DetailEnvoi({
  ligne: l,
  complement: c,
  texte,
  commentaire,
  date,
  raison,
  occupe,
  envoiSimule,
  accordTiktok,
  setAccordTiktok,
  outil,
  setOutil,
  envoyer,
  succes,
  suivante,
  selectionnee,
  alterner,
}: {
  ligne: LigneAPublier;
  complement: ComplementLigne;
  texte: string;
  commentaire: string;
  date: string;
  raison?: string;
  occupe: boolean;
  envoiSimule: boolean;
  accordTiktok: boolean;
  setAccordTiktok: (v: boolean) => void;
  outil: OutilAffiche;
  setOutil: (o: OutilAffiche) => void;
  envoyer: () => void;
  succes: string | null;
  suivante?: string | null;
  selectionnee: boolean;
  alterner?: (cle: string, v: boolean) => void;
}) {
  const id = useId();
  const [choix, setChoix] = useState(false);
  const jours = c.etat === "brouillon" ? joursRestantsBrouillon(c.creeLe) : null;
  const iso = Number.isNaN(new Date(date).getTime()) ? undefined : new Date(date).toISOString();
  const action = actionPrincipale({ etat: c.etat === "aucun" ? "brouillon" : c.etat, reseau: l.reseau, accordTiktok, dateEnvoi: c.etat === "programmee" ? c.dateEnvoi : iso, lien: c.lien });
  const bloc = blocPremierCommentaire(l.reseau, commentaire, etatPremierCommentaire(outil, l.reseau));
  const format = formatApercu(l.reseau, l.dimensions);
  const tiktokAttendu = l.reseau === "tiktok" && (c.etat === "aucun" || c.etat === "brouillon" || c.etat === "echec");
  const idPhrase = `${id}-phrase`;
  const empeche = action.type === "valider" ? (action.desactive ? action.raison : raison) : null;
  const iaVisible = mentionIAVisible(l.reseau) && l.casesRequises.includes("mentionIA");

  return (
    <div className="space-y-3">
      {/* Aperçu tel que publié */}
      <section aria-label={`Aperçu ${l.reseauNom}`} className="space-y-2 rounded-2xl border border-trait bg-surface-1 p-3">
        <div className="flex items-center gap-2">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-3 text-sm font-bold text-texte">{l.reseauNom.slice(0, 1)}</span>
          <LogoReseau reseau={l.reseau} taille="sm" />
          <span className="min-w-0 truncate text-sm font-semibold text-texte">{l.reseauNom}</span>
        </div>
        <div style={{ aspectRatio: format === "9:16" ? "9 / 16" : "4 / 5" }} data-format={format} className="mx-auto grid max-h-80 w-full max-w-[16rem] place-items-center overflow-hidden rounded-xl bg-surface-2 text-xs text-texte-faible">
          {l.jaquette ? <img src={l.jaquette} alt={`Image de la vidéo, format ${format}`} className="size-full object-cover" /> : <span>Format {format}</span>}
        </div>
        <p className="whitespace-pre-line text-sm text-texte">{texte}</p>
        {bloc && (
          <div className="rounded-xl bg-surface-2 p-2.5 text-sm">
            <p className="font-semibold text-texte-doux">{bloc.titre}</p>
            {bloc.texte && <p className="mt-0.5 whitespace-pre-line text-texte">{bloc.texte}</p>}
            {bloc.copier && bloc.texte && <BoutonCopier texte={bloc.texte} libelle="Copier" />}
          </div>
        )}
        {iaVisible && <p className="text-xs text-texte-faible">{LIBELLES_ENVOI.mentionIA}</p>}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Pastille ton={TONS_ETAT[c.etat]}>{ETIQUETTES_ETAT[c.etat]}</Pastille>
        {c.etat !== "publiee" && c.essai && <span className="text-xs text-texte-faible">{phraseEssais(l.reseauNom)}</span>}
      </div>

      {c.aussiSur.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-texte-doux">
          <span>{LIBELLES_ENVOI.aussiSur}</span>
          {c.aussiSur.map((x) => (
            <span key={x.reseau} className="rounded-full border border-trait px-2.5 py-0.5 text-xs font-semibold text-texte">{x.nom}</span>
          ))}
        </p>
      )}

      {jours !== null && (
        <p role="note" className="rounded-xl border border-ambre/40 bg-ambre-doux px-3 py-2 text-sm text-texte">{phraseBrouillonAProgrammer(jours)}</p>
      )}

      {c.etat === "echec" && (
        <div role="alert" className="space-y-1 rounded-xl border border-brique/40 bg-brique-doux px-3 py-2 text-sm text-texte">
          <p className="font-semibold">{phraseEchec(c.echecLe)}</p>
          {c.cause && <p>{c.cause}</p>}
        </div>
      )}

      {c.aVerifierId && <EnvoiAVerifier publicationId={c.aVerifierId} reseauNom={l.reseauNom} />}

      {tiktokAttendu && (
        <div className="space-y-0.5">
          <label className="flex min-h-11 items-start gap-3 rounded-2xl border border-trait px-3 py-2.5 text-sm font-semibold text-texte">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0" checked={accordTiktok} onChange={(e) => setAccordTiktok(e.target.checked)} />
            {LIBELLES_ENVOI.tiktokAccord}
          </label>
          <p className="px-1 text-xs text-texte-faible">{LIBELLES_ENVOI.tiktokAccordPetit}</p>
        </div>
      )}

      {/* Action principale UNIQUE */}
      <div className="space-y-1">
        {action.type === "valider" && (
          <>
            <Bouton icone="envoyer" pleineLargeur taille="lg" disabled={!!empeche || envoiSimule || occupe} aria-describedby={action.desactive ? idPhrase : undefined} chargement={occupe} onClick={envoyer}>
              {action.libelle}
            </Bouton>
            {action.petit && <p className="text-center text-xs text-texte-faible">{action.petit}</p>}
            {action.desactive && <p id={idPhrase} className="text-sm text-texte-doux">{LIBELLES_ENVOI.tiktokAccordManquant}</p>}
            {!action.desactive && raison && <p className="text-sm text-texte-doux">{raison}</p>}
            {envoiSimule && <p className="text-sm text-texte-doux">{LIBELLES_ENVOI.simuleRaison}</p>}
          </>
        )}
        {action.type === "repasser" && (
          <>
            <p className="text-sm text-texte">{action.phrase}</p>
            <Bouton variante="secondaire" pleineLargeur taille="lg" disabled aria-describedby={`${id}-repasser`}>
              {action.libelle}
            </Bouton>
            <p id={`${id}-repasser`} className="text-xs text-texte-faible">Cette action n&apos;est pas encore disponible ici.</p>
          </>
        )}
        {action.type === "voir" && (
          <>
            <p className="text-sm text-texte">{action.phrase}</p>
            {action.lien && (
              <Bouton asChild variante="secondaire" pleineLargeur taille="lg" icone="lien">
                <a href={action.lien} target="_blank" rel="noreferrer">{action.libelle}</a>
              </Bouton>
            )}
          </>
        )}
        {action.type === "reessayer" && (
          <>
            <Bouton icone="envoyer" pleineLargeur taille="lg" disabled={envoiSimule || occupe || action.desactive} aria-describedby={action.desactive ? idPhrase : undefined} chargement={occupe} onClick={envoyer}>
              {action.libelle}
            </Bouton>
            {action.desactive && <p id={idPhrase} className="text-sm text-texte-doux">{LIBELLES_ENVOI.tiktokAccordManquant}</p>}
          </>
        )}
      </div>

      <BlocSucces succes={succes} suivante={suivante} />

      {/* « Envoi par » : discret ; le choix vaut pour CE contenu seulement. */}
      <div className="text-xs text-texte-faible">
        <p>
          {LIBELLES_ENVOI.envoyerPar} {nomOutil(outil)}
          {choixOutilPropose(c) && (
            <>
              {" · "}
              <button type="button" aria-expanded={choix} aria-controls={`${id}-outils`} onClick={() => setChoix(!choix)} className="min-h-11 px-1 font-semibold text-accent underline">
                {LIBELLES_ENVOI.changer}
              </button>
            </>
          )}
        </p>
        {choix && choixOutilPropose(c) && (
          <fieldset id={`${id}-outils`} className="mt-1 space-y-1">
            <legend className="sr-only">Envoi par</legend>
            {(["zernio", "buffer"] as const).map((o) => (
              <label key={o} className="flex min-h-11 items-center gap-2 text-sm text-texte">
                <input type="radio" name={`${id}-outil`} className="size-5" checked={outil === o} onChange={() => setOutil(o)} />
                {nomOutil(o)} {o === "zernio" ? `(${LIBELLES_ENVOI.recommande})` : `(${LIBELLES_ENVOI.jusquAu} ${FIN_BUFFER})`}
              </label>
            ))}
            <p>{LIBELLES_ENVOI.pourCeContenu}</p>
          </fieldset>
        )}
      </div>

      {alterner && (
        <label className="flex min-h-11 items-center gap-2 text-sm text-texte-doux">
          <input type="checkbox" className="size-5" checked={selectionnee} onChange={(e) => alterner(l.cle, e.target.checked)} />
          Ajouter à la sélection
        </label>
      )}
    </div>
  );
}

/** Envoi « à vérifier » : sortie manuelle une fois regardé chez l'outil. N'écrit que dans le studio. */
function EnvoiAVerifier({ publicationId, reseauNom }: { publicationId: string; reseauNom: string }) {
  const router = useRouter();
  const [occupe, demarrer] = useTransition();
  const marquer = () =>
    demarrer(async () => {
      const r = await marquerEnvoiVerifieAction(publicationId);
      if (r.ok) {
        notifier.succes("Envoi marqué comme vérifié.");
        router.refresh();
      } else notifier.erreur(r.message);
    });
  return (
    <div role="note" className="space-y-2 rounded-xl border border-ambre/40 bg-ambre-doux px-3 py-2 text-sm text-texte">
      <p>
        L&apos;envoi vers {reseauNom} est à vérifier : regardez dans l&apos;outil de publication s&apos;il y est. Une fois regardé, marquez-le comme vérifié. Rien n&apos;est modifié ni supprimé chez l&apos;outil.
      </p>
      <Bouton variante="secondaire" disabled={occupe} chargement={occupe} onClick={marquer}>
        Marquer comme vérifié
      </Bouton>
    </div>
  );
}
