"use client";

import { useRef, useState, useTransition } from "react";
import { deposerPreuveLicenceAction, modifierElementAction } from "@/app/(studio)/bibliotheque/actions";
import { envoyerFichiers } from "@/lib/envoi-multipart";
import { Bouton, Champ, Icone, Interrupteur, notifier, Pastille, PastilleEssai, SelecteurPastilles } from "@/components/ui";
import { LICENCES } from "@/domaine/libelles";
import type { EtatLicence, IdReseau, Licence, TypeLicence } from "@/domaine/types";
import { dateCourte } from "@/lib/dates";
import { RESEAUX } from "@/reseaux";

const TYPES: TypeLicence[] = ["propriete", "libre", "abonnement", "achat", "generee-ia", "a-verifier"];

/**
 * Bloc « Licence » d'un élément (AV2.3-12) : lecture, puis « Modifier » pour renseigner le type,
 * l'usage commercial, les réseaux autorisés, le crédit, l'expiration et la preuve.
 */
export function BlocLicence({ id, type, licence, etat, modifiable }: { id: string; type: string; licence: Licence; etat: EtatLicence; modifiable: boolean }) {
  const [edition, setEdition] = useState(false);
  const [l, setL] = useState<Licence>(licence);
  const [preuve, setPreuve] = useState<string | null>(licence.preuveFichierId ? "Preuve jointe" : null);
  const [enCours, demarrer] = useTransition();
  const fichier = useRef<HTMLInputElement>(null);
  const reseauxNoms = (r: IdReseau[]) => r.map((x) => RESEAUX.find((y) => y.id === x)?.nom ?? x).join(", ");

  function enregistrer() {
    demarrer(async () => {
      const r = await modifierElementAction(id, type, {
        licence: { type: l.type, usageCommercial: l.usageCommercial, reseaux: l.reseaux, creditObligatoire: l.creditObligatoire ?? "", expireLe: l.expireLe ?? "", source: l.source ?? "" },
      });
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes("Licence enregistrée");
      setEdition(false);
    });
  }

  function joindre(f: File | undefined) {
    if (!f) return;
    demarrer(async () => {
      const e = await envoyerFichiers([f], { typeEntite: "element", entiteId: `preuve-${id}` });
      if (!e.ok) return void notifier.erreur(e.message);
      const r = await deposerPreuveLicenceAction(id, type, { fichierId: e.fichierIds[0] });
      if (!r.ok) return void notifier.erreur(r.message);
      setPreuve(f.name);
      if (e.simulation) notifier.essai("preuve gardée, rien n'a été envoyé");
      else notifier.succes("Preuve jointe");
    });
  }

  if (edition) {
    return (
      <div className="grid gap-4 rounded-carte border border-orange/40 bg-surface-2 p-4">
        <SelecteurPastilles
          libelle="Licence"
          options={TYPES.map((t) => ({ valeur: t, libelle: LICENCES[t] }))}
          valeur={l.type}
          onChange={(t) => setL((x) => ({ ...x, type: t }))}
        />
        <Interrupteur libelle="Usage commercial autorisé" coche={l.usageCommercial} onChange={(v) => setL((x) => ({ ...x, usageCommercial: v }))} />
        <SelecteurPastilles
          multiple
          libelle="Réseaux autorisés (aucun choisi : tous)"
          options={RESEAUX.map((r) => ({ valeur: r.id, libelle: r.nom }))}
          valeur={l.reseaux}
          onChange={(v) => setL((x) => ({ ...x, reseaux: v }))}
        />
        <Champ libelle="Crédit à ajouter à la légende" value={l.creditObligatoire ?? ""} onChange={(e) => setL((x) => ({ ...x, creditObligatoire: e.target.value }))} placeholder="Musique : …" maxLength={120} />
        <Champ libelle="Valable jusqu'au" type="date" value={l.expireLe?.slice(0, 10) ?? ""} onChange={(e) => setL((x) => ({ ...x, expireLe: e.target.value || undefined }))} aide="Vide : sans limite." />
        <Champ libelle="Source" value={l.source ?? ""} onChange={(e) => setL((x) => ({ ...x, source: e.target.value }))} placeholder="Epidemic Sound, Artlist…" maxLength={80} />
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fichier} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => joindre(e.target.files?.[0])} tabIndex={-1} aria-hidden />
          <Bouton variante="secondaire" icone="document" essai chargement={enCours} onClick={() => fichier.current?.click()}>
            {preuve ? "Changer la preuve" : "Joindre une preuve"}
          </Bouton>
          {preuve && <span className="truncate text-sm text-texte-faible">{preuve}</span>}
        </div>
        <div className="flex gap-2">
          <Bouton
            variante="fantome"
            onClick={() => {
              setL(licence);
              setEdition(false);
            }}
          >
            Annuler
          </Bouton>
          <Bouton icone="coche" className="flex-1" chargement={enCours} onClick={enregistrer}>
            Enregistrer la licence
          </Bouton>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-carte border border-trait bg-surface-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-2 font-semibold text-texte">
          <Icone nom="certifie" size={18} className="shrink-0 text-texte-doux" />
          <span className="truncate">Licence : {LICENCES[licence.type] ?? "?"}</span>
        </p>
        {etat === "ok" ? (
          <Pastille ton="sauge" icone="valide">
            En règle
          </Pastille>
        ) : etat === "expiree" ? (
          <Pastille ton="brique" icone="attention">
            Expirée
          </Pastille>
        ) : (
          <Pastille ton="ambre" icone="attention">
            À vérifier
          </Pastille>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Pastille ton={licence.usageCommercial ? "sauge" : "ambre"}>{licence.usageCommercial ? "Usage commercial" : "Pas d'usage commercial"}</Pastille>
        <Pastille>{licence.reseaux.length ? reseauxNoms(licence.reseaux) : "Tous les réseaux"}</Pastille>
        {licence.expireLe && <Pastille ton={etat === "expiree" ? "brique" : "neutre"}>Jusqu&apos;au {dateCourte(licence.expireLe)}</Pastille>}
        {licence.source && <Pastille>{licence.source}</Pastille>}
        {preuve && (
          <Pastille icone="document">
            Preuve jointe <PastilleEssai className="ml-1" />
          </Pastille>
        )}
      </div>
      {licence.creditObligatoire && <p className="mt-2 text-sm text-texte-faible">Crédit ajouté à la légende : « {licence.creditObligatoire} »</p>}
      {etat === "a-verifier" && <p className="mt-2 text-sm text-ambre">Tant que la licence est « À vérifier », le kit de publication bloque cette vidéo.</p>}
      {modifiable && (
        <Bouton variante="secondaire" icone="ecrire" className="mt-3" onClick={() => setEdition(true)}>
          Modifier la licence
        </Bouton>
      )}
    </div>
  );
}
