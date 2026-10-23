"use client";

import { useState, type ChangeEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { cn } from "@/lib/cn";
import { TAILLE_MAX_DEPOT_OCTETS, verifierDepotTexte } from "../../domaine/visuels/depot";

const BIENTOT: { libelle: string; icone: NomIcone }[] = [
  { libelle: "Depuis une vidéo", icone: "video" },
  { libelle: "Depuis un article", icone: "document" },
  { libelle: "Depuis vos matières", icone: "bibliotheque" },
];

type Entree = "sujet" | "depot";

/** Création d'un carrousel : un sujet, ou un texte écrit en session. L'action est passée en props. */
export function FormulaireNouveauCarrousel({ creer }: { creer: (fd: FormData) => Promise<void> }) {
  const [entree, setEntree] = useState<Entree>("sujet");
  const [depot, setDepot] = useState("");
  const [erreur, setErreur] = useState<string | undefined>();

  async function lireFichier(e: ChangeEvent<HTMLInputElement>) {
    const entreeFichier = e.target;
    const f = entreeFichier.files?.[0];
    if (!f) return;
    if (f.size > TAILLE_MAX_DEPOT_OCTETS) {
      setErreur("Le fichier dépasse 64 Ko : déposez-en un plus court.");
      entreeFichier.value = "";
      return;
    }
    let texte: string;
    try {
      texte = await f.text();
    } catch {
      setErreur("Le fichier n'a pas pu être lu.");
      entreeFichier.value = "";
      return;
    }
    const v = verifierDepotTexte(texte);
    setErreur(v.ok ? undefined : v.message);
    if (v.ok) setDepot(texte);
    entreeFichier.value = ""; // permet de choisir deux fois le même fichier
  }

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="m-0 min-w-0 border-0 p-0">
        <legend className="mb-2 text-sm font-semibold text-texte-doux">Comment démarrer</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {([["sujet", "Un sujet"], ["depot", "Déposer un texte écrit en session"]] as const).map(([v, l]) => (
            <button
              key={v}
              type="button"
              aria-pressed={entree === v}
              onClick={() => setEntree(v)}
              className={cn(
                "min-h-12 rounded-carte border px-4 text-left text-[15px] font-semibold transition-colors",
                entree === v ? "border-orange bg-orange-doux text-orange-vif" : "border-trait bg-surface-1 text-texte-doux hover:border-trait-fort",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </fieldset>

      <ul className="grid grid-cols-3 gap-2" aria-label="Autres départs">
        {BIENTOT.map((b) => (
          <li key={b.libelle} className="flex min-h-24 flex-col justify-between gap-2 rounded-carte border border-trait bg-surface-1 p-3 opacity-45">
            <Icone nom={b.icone} size={20} className="text-texte-faible" />
            <span className="text-sm font-semibold leading-tight text-texte-doux">{b.libelle}</span>
            <span className="text-[11px] font-semibold text-texte-faible">bientôt</span>
          </li>
        ))}
      </ul>

      <form action={creer} hidden={entree !== "sujet"} className="flex flex-col gap-4">
        <input type="hidden" name="type" value="sujet" />
        <label htmlFor="carrousel-sujet" className="text-sm font-semibold text-texte-doux">
          De quoi parle votre carrousel ?
        </label>
        <input
          id="carrousel-sujet"
          name="sujet"
          required
          maxLength={200}
          placeholder="Par exemple : cinq erreurs à éviter au lancement"
          className="min-h-12 rounded-champ border border-trait bg-surface-1 px-3.5 text-[15px] text-texte placeholder:text-texte-faible focus:border-orange"
        />
        <Bouton type="submit" icone="etincelles" className="self-start">
          Créer le carrousel
        </Bouton>
      </form>

      <form action={creer} hidden={entree !== "depot"} className="flex flex-col gap-4">
        <input type="hidden" name="type" value="paquet-session" />
        <label htmlFor="carrousel-depot" className="text-sm font-semibold text-texte-doux">
          Collez le texte (JSON) écrit en session
        </label>
        <textarea
          id="carrousel-depot"
          name="contenu"
          required
          rows={8}
          value={depot}
          onChange={(e) => {
            const v = verifierDepotTexte(e.target.value);
            setDepot(e.target.value);
            setErreur(e.target.value === "" || v.ok ? undefined : v.message);
          }}
          aria-invalid={!!erreur || undefined}
          className="rounded-champ border border-trait bg-surface-1 px-3.5 py-3 font-mono text-sm text-texte focus:border-orange"
        />
        <label htmlFor="carrousel-fichier" className="text-sm font-semibold text-texte-doux">
          Ou choisissez un fichier .json (64 Ko au plus)
        </label>
        <input id="carrousel-fichier" type="file" accept=".json,application/json" onChange={lireFichier} className="min-h-11 text-sm text-texte-doux" />
        {erreur && (
          <p role="alert" className="text-sm text-brique">
            {erreur}
          </p>
        )}
        <Bouton type="submit" icone="etincelles" disabled={!!erreur || depot.trim() === ""} className="self-start">
          Créer le carrousel
        </Bouton>
      </form>
    </div>
  );
}
