"use client";
import { useState } from "react";
import { formaterDate, postsConfirmables, type PostMigration } from "./logique";
import type { ComparaisonPost, ServiceImport } from "./services";

const CHAMPS: [keyof ComparaisonPost["original"], string][] = [
  ["texte", "Texte"], ["medias", "Médias"], ["date", "Date"], ["compte", "Compte"], ["premierCommentaire", "Premier commentaire"],
];

/** Fenêtre « Lot B · N posts » : copie Zernio face à l'original Buffer, « C’est juste » par post, un seul bouton principal. */
export function FenetreLot({ titre, posts, comparaisons, service, maintenant, onFermer, onJuste, onConfirmer }: {
  titre: string;
  posts: PostMigration[];
  comparaisons: ComparaisonPost[];
  service: ServiceImport;
  maintenant: Date;
  onFermer: () => void;
  onJuste?: (id: string) => void;
  onConfirmer?: (ids: string[]) => void;
}) {
  const [justes, setJustes] = useState<Set<string>>(new Set(posts.filter((p) => p.cJuste).map((p) => p.id)));
  const [confirmation, setConfirmation] = useState(false);
  // « C’est juste » n'est qu'un aperçu local. Au branchement, onConfirmer doit appeler confirmerRetraitEtProgrammation
  // CÔTÉ SERVEUR, qui revérifie état, date et vérification : ne jamais se fier au cJuste local.
  const vus = posts.map((p) => ({ ...p, cJuste: justes.has(p.id) }));
  const admis = postsConfirmables(vus, maintenant);
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="mig-fenetre" className="fixed inset-0 z-50 overflow-y-auto bg-fond p-4">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 id="mig-fenetre" className="text-lg text-texte">{titre} · {posts.length} post{posts.length > 1 ? "s" : ""}</h2>
          <button type="button" onClick={onFermer} aria-label="Fermer la fenêtre" className="min-h-11 rounded-full border border-trait-fort px-4 text-sm font-semibold">Fermer</button>
        </div>
        {posts.length === 0 && <p className="mt-4 text-texte-doux">Aucun post dans ce lot.</p>}
        {posts.map((p) => {
          const cmp = comparaisons.find((c) => c.postId === p.id);
          return (
            <article key={p.id} className="mt-4 rounded-carte border border-trait bg-surface-1 p-4">
              <h3 className="font-semibold text-texte">{p.titre} · prévu le {formaterDate(p.datePrevue)}</h3>
              {cmp ? (
                <dl className="mt-2 grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="sr-only">Champ</dt><dd className="font-semibold text-texte-doux">&nbsp;</dd><dd className="font-semibold">Buffer · Zernio</dd>
                  {CHAMPS.map(([k, nom]) => (
                    <div key={k} className="contents">
                      <dt className="text-texte-doux">{nom}</dt>
                      <dd>{cmp.original[k]}</dd>
                      <dd className={cmp.original[k] === cmp.copie[k] ? "" : "text-brique"}>{cmp.copie[k]}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-2 text-sm text-texte-doux">{service.disponible ? "Comparaison en préparation." : service.raison}</p>
              )}
              <button
                type="button"
                disabled={!cmp || justes.has(p.id)}
                onClick={() => { setJustes(new Set(justes).add(p.id)); onJuste?.(p.id); }}
                className="mt-3 min-h-11 rounded-full bg-surface-2 px-4 text-sm font-semibold text-texte disabled:opacity-50"
              >
                {justes.has(p.id) ? "Vérifié" : "C’est juste"}
              </button>
            </article>
          );
        })}
        <div className="mt-4">
          <button
            type="button"
            disabled={!service.disponible || admis.length === 0}
            onClick={() => setConfirmation(true)}
            className="min-h-12 w-full rounded-full bg-orange px-5 font-semibold text-sur-orange disabled:opacity-50"
          >
            Retirer de Buffer et programmer
          </button>
          {(!service.disponible || admis.length === 0) && (
            <p className="mt-1 text-sm text-texte-doux">{!service.disponible ? service.raison : "Disponible dès qu’un post est vérifié, à plus de 30 min de son envoi."}</p>
          )}
        </div>
        {confirmation && (
          <div role="alertdialog" aria-modal="true" aria-labelledby="mig-confirmer" className="mt-4 rounded-carte border border-brique/40 bg-brique-doux p-4">
            <h3 id="mig-confirmer" className="font-semibold text-texte">Retirer {admis.length} post{admis.length > 1 ? "s" : ""} de Buffer et les programmer chez Zernio ?</h3>
            <div className="mt-3 flex gap-3">
              <button type="button" onClick={() => setConfirmation(false)} className="min-h-11 rounded-full border border-trait-fort px-4 text-sm font-semibold">Annuler</button>
              <button type="button" onClick={() => { onConfirmer?.(admis.map((p) => p.id)); setConfirmation(false); }} className="min-h-11 rounded-full bg-orange px-4 text-sm font-semibold text-sur-orange">Retirer et programmer</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
