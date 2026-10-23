"use client";

/**
 * « DISCUTER AVEC MON MONTEUR » (plan facecam v4, précision du 09/10 ; lot D). Un vrai fil de discussion, au clavier ou
 * au micro, sur « Votre vidéo ». Il remplace « Une remarque ici » et « Vos demandes ».
 * - Lot J : une option PAYANTE demandée (décor IA, 3 caméras, ultra réaliste) n'est pas faite : le monteur répond avec
 * la carte « Option payante » (Confirmer / Annuler). Le reste s'applique sans confirmation.
 * - Chaque message s'applique SANS confirmation (format sans prix) : une nouvelle version part, l'ancienne reste visible
 *   pendant le recalcul et accessible ensuite (« Revenir à la version d'avant »).
 * - « Que puis-je demander ? » propose des exemples à toucher ; lot K : les effets portent leur mention (« réaliste,
 *   payant » : effet réaliste par IA, toujours confirmé ; « en 3D, gratuit »).
 * - Lot K : la carte d'un effet réaliste montre l'aperçu du moment (image, phrase) et « Changer de moment ».
 * - Une animation sur mesure réussie peut être gardée (« Garder ce modèle ») : elle rejoint « Mes animations ».
 * - « Appliquer aux prochaines vidéos » range la demande dans Réglages › Mes habitudes.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { discuterAvecMonteurAction, garderAnimationAction } from "@/app/(studio)/videos/actions-facecam";
import { ajouterDicte, BoutonMicro, useDictee } from "@/components/matieres/Dictee";
import { CarteConfirmation } from "@/components/options-payantes/CarteOptionPayante";
import { Bouton } from "@/components/ui/Bouton";
import { CaseACocher } from "@/components/ui/CaseACocher";
import { Icone } from "@/components/ui/Icone";
import { Pastille } from "@/components/ui/Pastille";
import { notifier } from "@/components/ui/Toast";
import { ZoneTexte } from "@/components/ui/ZoneTexte";
import { EtatFacecam, LIBELLES_ETAT_FACECAM } from "@/domaine/facecam";
import { cleSaisie, useSaisieGardee } from "@/hooks/useSaisieGardee";
import { cn } from "@/lib/cn";
import { marquerEnvoi } from "@/lib/mise-a-jour-studio";
import type { EchangeMonteur } from "@/services/monteur-facecam";

export function FilMonteur({
  videoId,
  fil: initial,
  exemples,
  exemplesEffets = [],
  possible,
}: {
  videoId: string;
  fil: EchangeMonteur[];
  exemples: string[];
  /** Lot K : exemples d'effets avec leur mention (« réaliste, payant » ou « en 3D, gratuit »). */
  exemplesEffets?: { texte: string; mention: string }[];
  possible: boolean;
}) {
  const router = useRouter();
  const [fil, setFil] = useState(initial);
  const [texte, setTexte] = useState("");
  const [dicte, setDicte] = useState(false);
  const [garder, setGarder] = useState(false);
  const [idees, setIdees] = useState(false);
  const [gardees, setGardees] = useState<Set<string>>(new Set());
  const [envoi, demarrer] = useTransition();
  const champ = useRef<HTMLTextAreaElement>(null);
  const bas = useRef<HTMLDivElement>(null);
  const { ecoute, basculer } = useDictee((m) => {
    setDicte(true);
    setTexte((t) => ajouterDicte(t, m));
  }, champ);

  // Nouveau fil reçu du serveur (après `router.refresh()`) : il remplace le fil affiché, pendant le rendu.
  const [filRecu, setFilRecu] = useState(initial);
  if (filRecu !== initial) {
    setFilRecu(initial);
    setFil(initial);
  }
  const provisoires = useRef(0);
  // Accolades obligatoires : dans les Chrome récents, scrollIntoView renvoie une promesse ; renvoyée par l'effet, React
  // la prend pour une fonction de nettoyage et l'écran plante à l'envoi (« i is not a function », constat prod du 11/10).
  useEffect(() => {
    bas.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [fil.length, envoi]);

  function envoyer(t = texte, reglages = { dicte, garder }) {
    const message = t.trim();
    if (!message || envoi) return;
    const provisoire: EchangeMonteur = { id: `attente-${++provisoires.current}`, le: new Date().toISOString(), de: "will", texte: message, ...(reglages.dicte ? { dicte: true } : {}) };
    setFil((f) => [...f, provisoire]);
    setTexte("");
    setIdees(false);
    demarrer(async () => {
      // Page ouverte avant une mise en ligne : si le studio ne connaît plus l'action, le message (déjà retiré du champ)
      // est gardé puis renvoyé une fois après le rechargement (src/lib/mise-a-jour-studio.ts).
      const fin = marquerEnvoi(cleSaisie(`monteur:${videoId}`), message, reglages);
      let r: Awaited<ReturnType<typeof discuterAvecMonteurAction>>;
      try {
        r = await discuterAvecMonteurAction(videoId, message, { dicte: reglages.dicte, garderPourLesProchaines: reglages.garder });
      } finally {
        fin();
      }
      if (!r.ok) {
        setFil((f) => f.filter((x) => x.id !== provisoire.id));
        setTexte(message);
        notifier.erreur(r.message);
        return;
      }
      setFil((f) => [...f.filter((x) => x.id !== provisoire.id), r.donnees.will, r.donnees.monteur]);
      setDicte(false);
      setGarder(false);
      if (reglages.garder) notifier.succes("Gardée pour les prochaines vidéos", "Retrouvez-la dans Réglages › Mes habitudes.");
      router.refresh();
    });
  }

  // Message refusé avant exécution par une mise en ligne (le serveur ne l'a jamais traité : aucun doublon) : renvoyé
  // UNE fois au montage qui suit le rechargement ; sans renvoi permis, il est simplement remis dans le champ.
  // (Le texte en cours de frappe, lui, est gardé par la zone de texte : ici, rien d'autre à lire.)
  useSaisieGardee(
    `monteur:${videoId}`,
    () => "",
    (t, gardee) => {
      if (gardee.renvoyer && possible) envoyer(t, { dicte: gardee.options?.dicte === true, garder: gardee.options?.garder === true });
      else setTexte(t);
    },
  );

  function garderModele(carte: NonNullable<EchangeMonteur["cartes"]>[number]) {
    demarrer(async () => {
      const r = await garderAnimationAction(videoId, carte.contenuCle, carte.description);
      if (!r.ok) {
        notifier.erreur(r.message);
        return;
      }
      setGardees((s) => new Set(s).add(carte.contenuCle));
      notifier.succes("Animation gardée", `« ${r.donnees.nom} » est dans Bibliothèque › Mes animations.`);
    });
  }

  return (
    <section aria-label="Discuter avec mon monteur" className="rounded-carte border border-trait bg-surface-1 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-texte-doux">
          <Icone nom="etincelles" size={16} className="text-orange-vif" />
          Discuter avec mon monteur
        </h3>
        {possible && (
          <button type="button" onClick={() => setIdees((v) => !v)} aria-expanded={idees} className="min-h-11 rounded-full px-2 text-sm font-semibold text-orange-vif hover:underline">
            Que puis-je demander ?
          </button>
        )}
      </div>

      {fil.length === 0 && !envoi && <p className="mb-3 text-[15px] text-texte-doux">Dites-lui ce que vous voulez changer, comme à un monteur : « à 0:32, montre les 3 étapes en escalier », « plus chaud », « rajoute un générique ».</p>}

      {fil.length > 0 && (
        <ol className="mb-4 max-h-[60vh] space-y-3 overflow-y-auto overscroll-contain pr-1" aria-live="polite">
          {fil.map((e) =>
            e.de === "will" ? (
              <li key={e.id} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-orange-doux px-3 py-2 text-[15px] text-texte">
                {e.dicte && <Icone nom="micro" size={13} className="mr-1 inline align-[-2px] text-orange-vif" aria-label="Dicté" />}
                {e.texte}
              </li>
            ) : (
              <li key={e.id} className={cn("max-w-[92%] rounded-2xl rounded-bl-md border px-3 py-2.5", e.etat && LIBELLES_ETAT_FACECAM[e.etat]?.ton === "orange" ? "border-ambre/40 bg-ambre-doux" : "border-trait bg-surface-2")}>
                <p className="text-[15px] text-texte">{e.texte}</p>
                {e.resumes && e.resumes.length > 1 && (
                  <ul className="mt-1.5 space-y-0.5 text-sm text-texte-doux">
                    {e.resumes.map((r) => (
                      <li key={r.consigneId} className="flex items-start gap-1.5">
                        <Icone nom={r.comprise ? "coche" : "info"} size={14} className={cn("mt-0.5 shrink-0", r.comprise ? "text-sauge" : "text-ambre")} />
                        {r.resume}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {e.versionId && (
                    <Pastille ton="sauge" icone="repeter">
                      Nouvelle version en route
                    </Pastille>
                  )}
                  {e.versionSimple && <Pastille ton="ambre">Version simple</Pastille>}
                  {e.etat === EtatFacecam.ConsigneNonComprise && (
                    <button type="button" onClick={() => champ.current?.focus()} className="min-h-11 text-sm font-semibold text-orange-vif hover:underline">
                      Reformuler
                    </button>
                  )}
                </div>
                {e.confirmation && (
                  <CarteConfirmation
                    carte={e.confirmation}
                    videoId={videoId}
                    onRepondu={() => router.refresh()}
                    onChangerMoment={() => {
                      setTexte("Plutôt à 0:");
                      champ.current?.focus();
                    }}
                  />
                )}
                {e.cartes?.map((c) => (
                  <div key={c.contenuCle} className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-trait bg-surface-1 px-3 py-2">
                    <p className="min-w-0 truncate text-sm text-texte-doux">{c.description}</p>
                    {gardees.has(c.contenuCle) ? (
                      <Pastille ton="sauge" icone="coche">
                        Gardé
                      </Pastille>
                    ) : (
                      <Bouton variante="contour" icone="signet" disabled={envoi} onClick={() => garderModele(c)} className="shrink-0">
                        Garder ce modèle
                      </Bouton>
                    )}
                  </div>
                ))}
              </li>
            ),
          )}
          {envoi && (
            <li className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-md border border-trait bg-surface-2 px-3 py-2.5 text-sm text-texte-doux">
              <span aria-hidden className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="size-1.5 animate-bounce rounded-full bg-texte-faible" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </span>
              Le monteur s&apos;en occupe…
            </li>
          )}
          <div ref={bas} />
        </ol>
      )}

      {possible ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            envoyer();
          }}
          className="space-y-3"
        >
          {idees && (
            <div className="sans-barre -mx-4 flex gap-2 overflow-x-auto px-4" role="list" aria-label="Exemples">
              {exemples
                .filter((x) => !exemplesEffets.some((e) => e.texte === x))
                .map((x) => (
                  <button key={x} role="listitem" type="button" onClick={() => envoyer(x)} className="min-h-11 shrink-0 rounded-full border border-trait bg-surface-2 px-3.5 text-sm text-texte-doux hover:text-texte">
                    {x}
                  </button>
                ))}
              {exemplesEffets.map((x) => (
                <button key={x.texte} role="listitem" type="button" onClick={() => envoyer(x.texte)} className="min-h-11 shrink-0 rounded-full border border-trait bg-surface-2 px-3.5 text-left text-sm text-texte-doux hover:text-texte">
                  {x.texte} <span className="text-xs text-texte-faible">({x.mention})</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-3">
            <ZoneTexte
              ref={champ}
              libelle="Votre message au monteur"
              libelleMasque
              rows={2}
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  envoyer();
                }
              }}
              placeholder="Ex. : plus chaud, et un générique à la fin"
              longueurMax={1000}
              className="flex-1"
            />
            <BoutonMicro ecoute={ecoute} onClick={basculer} taille="md" libelle="" />
          </div>
          <CaseACocher coche={garder} onChange={setGarder} libelle="Appliquer aux prochaines vidéos" />
          <Bouton type="submit" icone="envoyer" pleineLargeur chargement={envoi} disabled={!texte.trim()}>
            Envoyer au monteur
          </Bouton>
        </form>
      ) : (
        <p className="text-sm text-texte-faible">Disponible quand la vidéo est prête.</p>
      )}
    </section>
  );
}
