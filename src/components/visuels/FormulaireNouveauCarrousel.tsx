"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { Bouton } from "@/components/ui/Bouton";
import { Icone, type NomIcone } from "@/components/ui/Icone";
import { cn } from "@/lib/cn";
import { TAILLE_MAX_DEPOT_OCTETS, verifierDepotTexte } from "../../domaine/visuels/depot";
import { ETAT_INITIAL, type EtatCreation } from "../../domaine/visuels/etat-creation";
import type { AideFormat } from "../../visuels/texte/aide-format";

const BIENTOT: { libelle: string; icone: NomIcone }[] = [
  { libelle: "Depuis une vidéo", icone: "video" },
  { libelle: "Depuis un article", icone: "document" },
  { libelle: "Depuis vos matières", icone: "bibliotheque" },
];

type Entree = "sujet" | "depot";

/** Bloc dépliable « Format attendu » : modèle JSON copiable + limites de chaque type de page (générés côté serveur). */
export function FormatAttendu({ aide }: { aide: AideFormat }) {
  const [copie, setCopie] = useState<"non" | "oui" | "echec">("non");
  async function copier() {
    try {
      await navigator.clipboard.writeText(aide.modele);
      setCopie("oui");
    } catch {
      setCopie("echec");
    }
  }
  return (
    <details className="rounded-carte border border-trait bg-surface-1">
      <summary className="flex min-h-11 cursor-pointer list-none items-center px-4 text-sm font-semibold text-texte hover:text-orange-vif">Format attendu</summary>
      <div className="flex flex-col gap-4 border-t border-trait p-4 text-sm text-texte-doux">
        <p>
          Le texte est un JSON avec : la version du paquet, le sujet, le titre, une phrase « pourquoi » par page, et le carrousel (texte alternatif et de {aide.pagesMin} à {aide.pagesMax} pages). La première page est une couverture, la dernière est la page sombre T21. Aucun lien, aucun chiffre.
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <Bouton type="button" variante="secondaire" onClick={copier}>
              Copier le modèle
            </Bouton>
            <span role="status" className="text-xs text-texte-faible">
              {copie === "oui" ? "Modèle copié." : copie === "echec" ? "Copie impossible : sélectionnez le modèle à la main." : ""}
            </span>
          </div>
          <pre aria-label="Modèle de texte à copier" tabIndex={0} className="max-h-72 overflow-auto rounded-champ border border-trait bg-surface-2 p-3 font-mono text-xs text-texte">
            {aide.modele}
          </pre>
        </div>
        <section aria-label="Types de pages admis" className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-texte">Types de pages admis</h3>
          <p>Titre au plus {aide.plafondTitre} signes, et moins selon le type.</p>
          <ul className="flex flex-col gap-3">
            {aide.types.map((t) => (
              <li key={t.id} className="rounded-champ border border-trait bg-surface-2 p-3">
                <p className="font-semibold text-texte">
                  <code className="mr-2 font-mono">{t.id}</code>
                  {t.nom}
                </p>
                <p className="mt-0.5 text-xs text-texte-faible">{t.role}</p>
                <ul className="mt-1.5 list-disc pl-5 text-xs">
                  {t.lignes.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </details>
  );
}

/** Création d'un carrousel : un sujet, ou un texte écrit en session. L'action est passée en props (signature `useActionState`). */
export function FormulaireNouveauCarrousel({
  creer,
  aide,
  allume = true,
  entreeInitiale = "sujet",
}: {
  creer: (etat: EtatCreation, fd: FormData) => Promise<EtatCreation>;
  aide: AideFormat;
  allume?: boolean;
  entreeInitiale?: Entree;
}) {
  const [etat, action, enCours] = useActionState(creer, ETAT_INITIAL);
  const [entree, setEntree] = useState<Entree>(entreeInitiale);
  // Les champs sont contrôlés : une erreur ne vide jamais ce qui a été saisi ou collé.
  const [sujet, setSujet] = useState(("sujet" in etat && etat.sujet) || "");
  const [depot, setDepot] = useState(("contenu" in etat && etat.contenu) || "");
  // React 19 réinitialise le <form action> après l'envoi : ce que l'action a gardé revient dans les champs.
  const [etatVu, setEtatVu] = useState(etat);
  if (etatVu !== etat) {
    setEtatVu(etat);
    if ("sujet" in etat && etat.sujet !== undefined) setSujet(etat.sujet);
    if ("contenu" in etat && etat.contenu !== undefined) setDepot(etat.contenu);
  }
  const [erreur, setErreur] = useState<string | undefined>();
  const phrases = "erreurs" in etat ? etat.erreurs : [];
  const eteint = "eteint" in etat && etat.eteint === true;
  const grise = !allume || enCours || eteint;
  const pourquoiGrise = allume ? undefined : "bandeau-generateur-eteint";

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

      {eteint && allume && (
        <p role="alert" className="rounded-carte border border-ambre/30 bg-ambre-doux p-4 text-sm font-semibold text-ambre">
          Le générateur de carrousels vient d&apos;être éteint : rien ne sera écrit ni rendu. Votre texte est gardé ; rallumez-le dans les réglages puis rechargez la page.
        </p>
      )}
      {phrases.length > 0 && (
        <div role="alert" className="rounded-carte border border-brique/40 bg-brique-doux p-4 text-sm text-brique">
          <p className="font-semibold">{phrases.length > 1 ? "Ce texte n'a pas pu être pris, voici pourquoi :" : "Ce texte n'a pas pu être pris :"}</p>
          <ul className="mt-1.5 list-disc pl-5">
            {phrases.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <form action={action} hidden={entree !== "sujet"} className="flex flex-col gap-4">
        <input type="hidden" name="type" value="sujet" />
        <label htmlFor="carrousel-sujet" className="text-sm font-semibold text-texte-doux">
          De quoi parle votre carrousel ?
        </label>
        <input
          id="carrousel-sujet"
          name="sujet"
          required
          maxLength={200}
          value={sujet}
          onChange={(e) => setSujet(e.target.value)}
          placeholder="Par exemple : cinq erreurs à éviter au lancement"
          className="min-h-12 rounded-champ border border-trait bg-surface-1 px-3.5 text-[15px] text-texte placeholder:text-texte-faible focus:border-orange"
        />
        <p className="text-xs text-texte-faible">Le texte est un exemple de simulation (0 $), écrit sur un modèle du studio : votre sujet sert de titre quand il s&apos;y prête.</p>
        <Bouton type="submit" icone="etincelles" disabled={grise} aria-describedby={pourquoiGrise} className="self-start">
          Créer le carrousel
        </Bouton>
      </form>

      <form action={action} hidden={entree !== "depot"} className="flex flex-col gap-4">
        <input type="hidden" name="type" value="paquet-session" />
        <FormatAttendu aide={aide} />
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
          aria-invalid={!!erreur || phrases.length > 0 || undefined}
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
        <Bouton type="submit" icone="etincelles" disabled={grise || !!erreur || depot.trim() === ""} aria-describedby={pourquoiGrise} className="self-start">
          Créer le carrousel
        </Bouton>
      </form>
    </div>
  );
}
