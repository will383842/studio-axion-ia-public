"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cocherAvantDePublierAction, envoyerVersBufferAction, modifierTexteKitAction } from "@/app/(studio)/videos/actions";
import { programmerSujetAction } from "@/app/(studio)/mesures/actions";
import { Bouton } from "@/components/ui/Bouton";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { Pastille } from "@/components/ui/Pastille";
import { PastilleEssai } from "@/components/ui/PastilleEssai";
import { notifier } from "@/components/ui/Toast";
import { libelleComptes } from "@/domaine/comptes-envoi";
import type { LigneAPublier, VueAPublier } from "@/services/a-publier";
import { ligneCompteEtDate, messageSucces } from "./finitions-envoi";
import { casesAChanger, rapportLecteur, regrouperParVideo, toutesCochees, type CarteVideo } from "./regrouper-a-publier";

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
export function LignesAPublier({ vue, retour, reseauOuvert, suivantes }: { vue: VueAPublier; retour?: string; reseauOuvert?: string; suivantes?: Record<string, string | null> }) {
  const cartes = regrouperParVideo(vue.lignes);
  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 rounded-2xl border border-trait bg-surface-2 px-3 py-2.5 text-sm text-texte-doux">
        {vue.envoiSimule ? (
          <>
            <PastilleEssai /> Essai : rien ne part vers Buffer tant que la publication n&apos;est pas reliée.
          </>
        ) : vue.modeBuffer === "programmer" ? (
          "Les envois sont programmés dans Buffer à la date choisie."
        ) : (
          "Brouillon dans Buffer : rien ne part tant que vous ne l'avez pas programmé dans Buffer."
        )}
      </p>
      <ul className="space-y-4">
        {cartes.map((c) => (
          <CarteDeVideo key={`${c.videoId}:${reseauOuvert ?? ""}`} carte={c} envoiSimule={vue.envoiSimule} modeBuffer={vue.modeBuffer} retour={retour} reseauOuvert={reseauOuvert} suivantes={suivantes} />
        ))}
      </ul>
    </div>
  );
}

function CarteDeVideo({ carte, envoiSimule, modeBuffer, retour, reseauOuvert, suivantes }: { carte: CarteVideo; envoiSimule: boolean; modeBuffer: VueAPublier["modeBuffer"]; retour?: string; reseauOuvert?: string; suivantes?: Record<string, string | null> }) {
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

  return (
    <li className="rounded-carte border border-trait bg-surface-1 p-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/videos/${carte.videoId}`} className="min-w-0 text-base font-semibold text-texte hover:underline">
            {carte.titre}
          </Link>
          {etats.map((e) => (
            <Pastille key={e.cle} ton={e.ton}>
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

        {carte.pretes.length > 0 && (
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
                  className={`flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${ouvert === l.reseau ? "border-orange bg-surface-2 text-texte" : "border-trait text-texte-doux hover:border-orange"}`}
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
                      <Pastille ton={p.etat.ton}>{p.etat.libelle}</Pastille>
                      {p.etat.lien && (
                        <a href={p.etat.lien} target="_blank" rel="noreferrer" className="font-semibold text-orange-vif">
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
}) {
  const router = useRouter();
  const [succes, setSucces] = useState<string | null>(null);
  const [texte, setTexte] = useState(l.texte);
  const [commentaire, setCommentaire] = useState(l.premierCommentaire ?? "");
  const [date, setDate] = useState(() => versLocal(demainNeufHeures()));
  const [comptes, setComptes] = useState<string[]>(l.compte.memorises ?? []);
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
      {l.etat && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-texte-doux">
          <Pastille ton={l.etat.ton}>{l.etat.libelle}</Pastille>
          {l.etat.lien && (
            <a href={l.etat.lien} target="_blank" rel="noreferrer" className="font-semibold text-orange-vif">
              Voir la publication
            </a>
          )}
          {l.etat.detail}
        </p>
      )}

      <Bouton icone="envoyer" pleineLargeur disabled={!peutEnvoyer || enCoursCases} chargement={enCours} onClick={brouillon}>
        {modeBuffer === "programmer" ? "Programmer dans Buffer" : "Mettre en brouillon dans Buffer"}
      </Bouton>
      <p className="text-sm text-texte-doux">{ligneCompteEtDate(avecChoix ? comptes.map((c) => l.compte.choix!.find((x) => x.id === c)?.nom ?? c) : l.compte.nom ? [l.compte.nom] : [], date, avecChoix)}</p>
      <div role="status" className={succes ? "space-y-2 rounded-2xl border border-sauge/40 bg-surface-1 p-3 text-sm font-semibold text-texte" : undefined}>
        {succes && <p>{succes}</p>}
        {succes && suivante && (
          <Bouton asChild variante="secondaire" pleineLargeur icone="envoyer">
            <Link href={suivante}>Suivante</Link>
          </Bouton>
        )}
      </div>
      {raison && <p className="text-sm text-texte-doux">{raison}</p>}

      <details className="text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-orange-vif">Voir le détail</summary>
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
            <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={4} className="w-full rounded-champ border border-trait bg-surface-1 p-3 text-sm text-texte outline-none focus:border-orange" />
          </label>
          {modifie && (
            <Bouton variante="secondaire" icone="coche" chargement={enCours} onClick={enregistrerTexte}>
              Enregistrer le texte
            </Bouton>
          )}
          {l.motsDiese.length > 0 && <p className="text-xs text-texte-faible">{l.motsDiese.join(" ")}</p>}

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-texte-doux">Premier commentaire</span>
            <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={2} className="w-full rounded-champ border border-trait bg-surface-1 p-3 text-sm text-texte outline-none focus:border-orange" />
          </label>
          {commentaire.trim() && !l.commentaireTransmissible && <p className="text-sm text-texte-doux">{l.reseauNom} ne reçoit pas le premier commentaire par Buffer : rien ne sera envoyé, posez-le à la main.</p>}

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
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} className="min-h-12 w-full rounded-champ border border-trait bg-surface-1 px-3.5 text-[15px] text-texte outline-none [color-scheme:light] focus:border-orange sm:w-auto" />
          </label>
        </div>
      </details>
    </div>
  );
}
