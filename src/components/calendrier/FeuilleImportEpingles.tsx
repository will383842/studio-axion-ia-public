"use client";

/**
 * Import en lot d'épingles Pinterest (PR 6). Quatre gestes : analyser (à blanc), créer au calendrier (« à valider »),
 * « Valider ce lot » (avec confirmation). Aucun envoi n'est lancé d'ici : seul le tour du calendrier envoie, plus tard.
 */
import { useActionState, useState } from "react";
import { analyserLotAction, importerLotAction, validerLotAction, type EtatImport } from "@/app/(studio)/calendrier/importer-epingles/actions";
import { Bouton } from "@/components/ui/Bouton";
import { ApercuEpingle } from "@/components/visuels/ApercuEpingle";

const LIBELLES = { pret: "Prête", refusee: "Refusée", "deja-la": "Déjà là", "attente-image": "En attente d'image" } as const;

export function FeuilleImportEpingles({ comptes, jourParDefaut }: { comptes: { id: string; nom: string }[]; jourParDefaut: string }) {
  const [json, setJson] = useState("");
  const [analyse, analyser, enAnalyse] = useActionState<EtatImport, FormData>(analyserLotAction, {});
  const [cree, creer, enCreation] = useActionState<EtatImport, FormData>(importerLotAction, {});
  const [valide, valider, enValidation] = useActionState<EtatImport, FormData>(validerLotAction, {});
  const [confirmer, setConfirmer] = useState(false);
  const rapport = cree.rapport ?? analyse.rapport;
  const ids = cree.resultat?.creneauIds ?? [];

  return (
    <div className="space-y-5">
      <form className="space-y-3" aria-label="Lot d'épingles">
        <label className="flex flex-col gap-1 text-sm font-semibold text-texte-doux">
          Compte Pinterest
          <select name="compte" required className="min-h-11 rounded-champ border border-trait bg-surface-1 px-3 font-normal text-texte">
            {comptes.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-texte-doux">
          Jour de départ
          <input type="date" name="jourDepart" defaultValue={jourParDefaut} required className="min-h-11 rounded-champ border border-trait bg-surface-1 px-3 font-normal text-texte" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-texte-doux">
          Heures de ce lot (vide : celles de la cadence)
          <input type="text" name="heures" placeholder="08:30 12:30 17:30 21:00" className="min-h-11 rounded-champ border border-trait bg-surface-1 px-3 font-normal text-texte" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-texte-doux">
          Jours exclus (AAAA-MM-JJ, séparés par des espaces)
          <input type="text" name="joursExclus" className="min-h-11 rounded-champ border border-trait bg-surface-1 px-3 font-normal text-texte" />
        </label>
        <label className="flex items-center gap-2 text-sm text-texte-doux"><input type="checkbox" name="alterner" /> Alterner les tableaux</label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-texte-doux">
          Le lot (JSON, version 1)
          <textarea name="json" value={json} onChange={(e) => setJson(e.target.value)} rows={10} required className="rounded-champ border border-trait bg-surface-1 p-3 font-mono text-xs font-normal text-texte" />
        </label>
        <div className="flex flex-wrap gap-3">
          <Bouton type="submit" variante="secondaire" formAction={analyser} disabled={enAnalyse || !json.trim()}>Analyser (rien n'est écrit)</Bouton>
          <Bouton type="submit" variante="principal" formAction={creer} disabled={enCreation || !json.trim()}>Créer les épingles au calendrier</Bouton>
        </div>
      </form>

      {(analyse.erreur || cree.erreur) && <p role="alert" className="text-sm text-texte">{analyse.erreur ?? cree.erreur}</p>}
      {rapport && !rapport.ok && <p role="alert" className="text-sm text-texte">{rapport.erreur}</p>}
      {rapport?.ok && (
        <section aria-label="Rapport du lot" className="space-y-2">
          <p className="text-sm text-texte">
            {rapport.lus} lues : {rapport.lignes.filter((l) => l.statut === "pret").length} prêtes, {rapport.lignes.filter((l) => l.statut === "deja-la").length} déjà là,{" "}
            {rapport.lignes.filter((l) => l.statut === "refusee").length} refusées, {rapport.lignes.filter((l) => l.statut === "attente-image").length} en attente d'image.
          </p>
          {rapport.imagesAttendues.length > 0 && <p className="text-sm text-texte-doux">Images à déposer avec le lot : {rapport.imagesAttendues.join(", ")}.</p>}
          {rapport.avertissements.map((a) => <p key={a} className="text-sm text-texte-doux">{a}</p>)}
          <ul className="space-y-1 text-sm">
            {rapport.lignes.map((l) => (
              <li key={l.numero} className="rounded-champ border border-trait bg-surface-1 px-3 py-2">
                Ligne {l.numero} · {LIBELLES[l.statut]}
                {l.placement ? ` · ${l.placement.jour} à ${l.placement.heure}` : ""}
                {l.raisons.length ? ` — ${l.raisons.join(" ; ")}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {cree.resultat && ids.length > 0 && (
        <form action={valider} className="space-y-2" aria-label="Valider ce lot">
          <section aria-label="Aperçu des épingles du lot" className="space-y-3">
            <p className="text-sm text-texte-doux">Voici chaque épingle telle qu'elle partira : image, texte alternatif, tableau. Vérifiez avant de valider.</p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(cree.apercus ?? []).map((a) => (
                <li key={a.creneauId}>
                  <ApercuEpingle imageUrl={a.imageUrl} titre={a.titre} description={a.description} texteAlternatif={a.texteAlternatif} lien={a.lien} tableau={a.tableau} contenuIA={a.contenuIA} domaine={a.domaine} />
                </li>
              ))}
            </ul>
          </section>
          <input type="hidden" name="creneaux" value={ids.join(",")} />
          {!confirmer ? (
            <Bouton type="button" variante="principal" onClick={() => setConfirmer(true)}>Valider ce lot</Bouton>
          ) : (
            <>
              <p className="text-sm text-texte">Valider {ids.length} épingle(s) du calendrier ? Elles seront programmées dans le Studio ; l'envoi se fait ensuite au tour du calendrier.</p>
              <Bouton type="submit" variante="principal" disabled={enValidation}>Oui, valider {ids.length} épingle(s)</Bouton>
            </>
          )}
        </form>
      )}
      {valide.erreur && <p role="alert" className="text-sm text-texte">{valide.erreur}</p>}
      {valide.validation && (
        <p className="text-sm text-texte">
          {valide.validation.valides} validée(s), {valide.validation.ignores} ignorée(s), {valide.validation.erreurs.length} en erreur.
          {valide.validation.premier ? ` Du ${valide.validation.premier} au ${valide.validation.dernier}.` : ""}
        </p>
      )}
    </div>
  );
}
