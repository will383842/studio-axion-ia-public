"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { choisirCanalBufferAction, definirModeBufferAction, testerBufferAction } from "@/app/(studio)/reglages/actions-buffer";
import { Bouton } from "@/components/ui/Bouton";
import { Icone } from "@/components/ui/Icone";
import { LogoReseau } from "@/components/ui/LogoReseau";
import { Pastille } from "@/components/ui/Pastille";
import { SelecteurPastilles } from "@/components/ui/SelecteurPastilles";
import { notifier } from "@/components/ui/Toast";
import { libelleGenre } from "@/domaine/comptes-envoi";
import type { ModeEnvoiPublication } from "@/domaine/types";
import { ilYA } from "@/lib/dates";
import type { VueBuffer } from "@/services/buffer";

/** État affiché : la vérité (clé posée et Buffer choisi), jamais une promesse. */
function etat(vue: VueBuffer): { libelle: string; ton: "sauge" | "ambre" | "brique"; phrase: string } {
  if (vue.relie) return { libelle: "Relié", ton: "sauge", phrase: vue.mode === "brouillon" ? "Les vidéos arrivent en brouillon dans Buffer : vous les relisez et les programmez dans Buffer." : "Les vidéos partent à la date choisie dans le studio." };
  if (!vue.clePresente) return { libelle: "À relier", ton: "brique", phrase: "Il manque la clé Buffer sur le serveur. D'ici là, rien ne part : c'est un essai." };
  return { libelle: "Essai", ton: "ambre", phrase: "La clé est posée. Choisissez Buffer dans « Publication » pour que les vidéos partent vraiment." };
}

/**
 * Réglages > Connexions > Buffer (lot R1) : état, mode (brouillon d'abord), compte de chaque réseau, « Tester ».
 * Lot R1b : un réseau à plusieurs comptes se choisit À CHAQUE ENVOI ; ici, seulement le compte proposé par défaut.
 * Tout vient de la base (`vueBuffer`) : afficher ce bloc n'appelle jamais Buffer ; seul « Tester » le fait.
 */
export function BlocBuffer({ vue }: { vue: VueBuffer }) {
  const router = useRouter();
  const [test, demarrerTest] = useTransition();
  const [reglage, demarrerReglage] = useTransition();
  const e = etat(vue);

  function tester() {
    demarrerTest(async () => {
      const r = await testerBufferAction();
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes(r.donnees.message);
      router.refresh();
    });
  }

  function changerMode(mode: ModeEnvoiPublication) {
    demarrerReglage(async () => {
      const r = await definirModeBufferAction(mode);
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes(mode === "brouillon" ? "Brouillon dans Buffer" : "Programmation directe");
      router.refresh();
    });
  }

  function choisirComptes(reseau: VueBuffer["reseaux"][number]["reseau"], ids: string[]) {
    demarrerReglage(async () => {
      const r = await choisirCanalBufferAction(reseau, ids);
      if (!r.ok) return void notifier.erreur(r.message);
      notifier.succes(ids.length ? "Compte proposé par défaut" : "Choisi à chaque envoi");
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="bloc-buffer-titre" className="rounded-2xl border border-trait bg-surface-1 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-texte-doux">
          <Icone nom="envoyer" size={18} />
        </span>
        <h3 id="bloc-buffer-titre" className="min-w-0 flex-1 text-[15px] font-semibold text-texte">
          Buffer
        </h3>
        <Pastille ton={e.ton}>{e.libelle}</Pastille>
      </div>
      <p className="mt-3 text-sm text-texte-doux">{e.phrase}</p>

      <div className="mt-5">
        <SelecteurPastilles<ModeEnvoiPublication>
          libelle="Quand une vidéo part"
          valeur={vue.mode}
          onChange={changerMode}
          options={[
            { valeur: "brouillon", libelle: "Brouillon dans Buffer", detail: "Vous relisez et programmez dans Buffer", icone: "document", desactive: reglage },
            { valeur: "programmer", libelle: "Programmer directement", detail: "La date choisie ici part telle quelle", icone: "calendrier", desactive: reglage },
          ]}
        />
      </div>

      <div className="mt-5">
        <p className="mb-2 text-sm font-semibold text-texte-doux">Comptes dans Buffer</p>
        <ul className="space-y-2">
          {vue.reseaux.map((r) => (
            <li key={r.reseau} className="rounded-champ border border-trait bg-surface-2 px-3 py-2.5">
              <div className="flex min-h-10 items-center gap-3">
                <LogoReseau reseau={r.reseau} taille="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-texte">{r.nom}</span>
                  {r.compte ? (
                    <span className="block truncate text-xs text-texte-faible">{r.compte.nom}</span>
                  ) : r.probleme ? (
                    <span className="block text-xs text-brique">{r.probleme}</span>
                  ) : r.candidats.length > 1 ? (
                    <span className="block text-xs text-texte-faible">{r.candidats.length} comptes : vous choisissez à chaque envoi</span>
                  ) : (
                    <span className="block truncate text-xs text-texte-faible">{r.candidats[0]?.nom}</span>
                  )}
                  {r.avertissement && <span className="block text-xs text-ambre">{r.avertissement}</span>}
                </span>
                {(r.compte || (!r.probleme && r.candidats.length > 0)) && <Icone nom="valide" size={18} className="shrink-0 text-sauge" />}
              </div>
              {!r.compte && r.candidats.length > 0 && !r.probleme && (
                <div className="mt-2">
                  <SelecteurPastilles<string>
                    multiple
                    libelle={`Compte ${r.nom} proposé par défaut`}
                    valeur={r.proposes ?? []}
                    onChange={(ids) => choisirComptes(r.reseau, ids)}
                    options={r.candidats.map((c) => ({ valeur: c.id, libelle: c.nom, detail: libelleGenre(c.genre), desactive: reglage }))}
                  />
                  <p className="mt-1.5 text-xs text-texte-faible">Coché d&apos;office quand vous envoyez une vidéo, et utilisé par « Programmer les versions ». Votre dernier choix le remplace.</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Bouton variante="secondaire" icone="actualiser" chargement={test} disabled={!vue.relie} onClick={tester}>
          Tester
        </Bouton>
        <span className="text-xs text-texte-faible">{vue.lusLe ? `Comptes lus ${ilYA(vue.lusLe)}` : "Comptes pas encore lus"}</span>
      </div>
    </section>
  );
}
