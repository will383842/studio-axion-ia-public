"use client";

/**
 * Formulaire d'ajout du calendrier (L7-11, CAL-26b) : quatre questions (réseaux, type, contenu, date), plus le choix du
 * compte pour un réseau à plusieurs comptes. Il crée des créneaux « propose » : il ne publie jamais directement.
 * Cocher N réseaux (ou N comptes) crée N publications. Un ajout n'est jamais bloqué, sauf format refusé (le fichier seul
 * est alors laissé de côté). Anti double clic : le bouton se désactive pendant l'envoi, les clés du formulaire restent les mêmes.
 */
import { useRef, useState } from "react";
import { ajouterEntree, type ResultatAjout } from "@/app/(studio)/calendrier/actions/ajouter";
import { casesEnvoi, type ComptesEnvoi } from "@/domaine/comptes-envoi";
import type { IdReseau } from "@/domaine/types";
import { RESEAUX } from "@/reseaux";
import { ProposerTexte, type PropsProposerTexte, type TexteReseau } from "./ProposerTexte";
import type { TypeImporte } from "@/services/texte-post";
import { DepotMedia, envoyerFichierChoisi, type FichierChoisi, type ResultatEnvoiChoisi } from "./DepotMedia";
import { TYPES_CONTENU, type TypeContenu } from "./CarteEntreeCalendrier";

interface PropsAjouterEntree {
  /** Jour de Paris (AAAA-MM-JJ) déjà rempli à la question 4 ; le « + » d'une case y met le jour de la case. */
  jour: string;
  /** Compte d'envoi par défaut (réseau sans choix de compte, ou aucun compte coché). */
  compteCible: string;
  /** Réseau déjà coché à l'ouverture (le « + » d'une case y met le réseau de la case). */
  reseau?: IdReseau;
  proposer?: PropsProposerTexte["proposer"];
  type?: TypeImporte;
  /** Comptes à cocher par réseau (src/domaine/comptes-envoi.ts) ; aucun n'est coché par défaut. */
  comptesReseau?: ComptesEnvoi;
}

type Cible = { reseau: IdReseau; compteCible: string };

export function AjouterEntree({ jour, compteCible, reseau = "linkedin", proposer, type = "video", comptesReseau }: PropsAjouterEntree) {
  const cle = useRef(crypto.randomUUID());
  const [reseaux, setReseaux] = useState<IdReseau[]>([reseau]);
  const [comptes, setComptes] = useState<Partial<Record<IdReseau, string[]>>>({});
  const [typeContenu, setTypeContenu] = useState<TypeContenu>(type in TYPES_CONTENU ? (type as TypeContenu) : "video");
  const [jourSaisi, setJourSaisi] = useState(jour);
  const [heure, setHeure] = useState("09:00");
  const [choisi, setChoisi] = useState<FichierChoisi | null>(null);
  const [textes, setTextes] = useState<Record<string, TexteReseau>>({});
  const [enCours, setEnCours] = useState(false);
  const [nonEnvoye, setNonEnvoye] = useState<string | null>(null);
  const [retour, setRetour] = useState<ResultatAjout | null>(null);
  const [nombre, setNombre] = useState(0);

  // Confirmations déjà données pour cette saisie (le passé, puis la proximité ou le quota).
  const dejaEnvoye = useRef<Record<string, { fichier: File; envoi: ResultatEnvoiChoisi }>>({});
  const confirme = useRef({ passe: false, proximite: false });

  const basculerReseau = (r: IdReseau, coche: boolean) => setReseaux((l) => (coche ? (l.includes(r) ? l : [...l, r]) : l.filter((x) => x !== r)));
  const basculerCompte = (r: IdReseau, id: string, coche: boolean) => setComptes((c) => ({ ...c, [r]: coche ? [...(c[r] ?? []).filter((x) => x !== id), id] : (c[r] ?? []).filter((x) => x !== id) }));

  /** Une publication par réseau coché, ou par compte coché pour un réseau à plusieurs comptes. Aucun compte coché : compte par défaut. */
  function cibles(): Cible[] {
    return reseaux.flatMap((r): Cible[] => {
      const cochesDuReseau = (comptesReseau?.[r]?.choix ?? []).filter((c) => comptes[r]?.includes(c.id));
      return cochesDuReseau.length ? cochesDuReseau.map((c) => ({ reseau: r, compteCible: c.id })) : [{ reseau: r, compteCible }];
    });
  }

  async function envoyer(confirmation?: "passe" | "proximite" | "quota") {
    if (enCours) return;
    if (confirmation === "passe") confirme.current.passe = true;
    if (confirmation === "proximite" || confirmation === "quota") confirme.current.proximite = true;
    setEnCours(true);
    try {
      const liste = cibles();
      const fichier = choisi?.fichier;
      const messages: string[] = [];
      const avertissements: string[] = [];
      let premierEchec: ResultatAjout | null = null;
      let crees = 0;
      for (const [i, cible] of liste.entries()) {
        const cleCible = liste.length > 1 ? `${cle.current}-${i}` : cle.current;
        // Le fichier choisi part vraiment (dépôt existant) avant la création de l'entrée, qui le rattache.
        // Déjà envoyé pour cette cible (clic sur « Ajouter quand même ») : on ne le renvoie pas.
        // Un format refusé ou un envoi en échec n'empêche JAMAIS l'ajout.
        const memo = dejaEnvoye.current[cleCible];
        const envoi = fichier && memo?.fichier === fichier ? memo.envoi : await envoyerFichierChoisi(fichier, cible.reseau, `manuel-${cleCible}`);
        if (envoi.ok && fichier && !envoi.nonEnvoye) dejaEnvoye.current[cleCible] = { fichier, envoi };
        if (envoi.nonEnvoye && !messages.includes(envoi.nonEnvoye)) messages.push(envoi.nonEnvoye);
        const r = await ajouterEntree({ jour: jourSaisi, heure, compteCible: cible.compteCible, reseau: cible.reseau, videoId: envoi.videoId, ...(envoi.visuelId ? { visuelId: envoi.visuelId } : {}), ...(textes[cible.reseau]?.texte.trim() ? { textes } : {}), cle: cleCible, confirmerPasse: confirme.current.passe, confirmerProximite: confirme.current.proximite });
        if (r.ok) {
          crees += 1;
          if (r.avertissement) avertissements.push(r.avertissement);
        } else premierEchec ??= r;
      }
      setNonEnvoye(messages.length ? messages.join(" ") : null);
      setNombre(crees);
      setRetour(premierEchec ?? { ok: true, donnees: undefined as never, ...(avertissements.length ? { avertissement: avertissements.join(" ") } : {}) });
      // Succès complet : nouvelles clés, pour qu'un 2e ajout depuis ce formulaire crée bien de nouveaux créneaux.
      if (!premierEchec) {
        cle.current = crypto.randomUUID();
        dejaEnvoye.current = {};
        confirme.current = { passe: false, proximite: false };
      }
    } finally {
      setEnCours(false);
    }
  }

  const reseauxAvecComptes = reseaux.filter((r) => comptesReseau?.[r]?.choix?.length);

  return (
    <form onSubmit={(e) => { e.preventDefault(); confirme.current = { passe: false, proximite: false }; void envoyer(); }} aria-label={`Ajouter une entrée le ${jour}`}>
      <p>Ajouter le {jour}</p>
      <p>Elle arrive « À valider ». Rien ne part sans votre validation.</p>

      <fieldset>
        <legend>1. Sur quels réseaux ?</legend>
        {RESEAUX.map((r) => (
          <label key={r.id}>
            <input type="checkbox" name="reseau" value={r.id} checked={reseaux.includes(r.id)} onChange={(e) => basculerReseau(r.id, e.target.checked)} /> {r.nom}
          </label>
        ))}
      </fieldset>

      {reseauxAvecComptes.length > 0 && (
        <fieldset>
          <legend>1 bis. Sur quel compte ? (aucun n'est coché d'avance)</legend>
          {reseauxAvecComptes.map((r) =>
            casesEnvoi([{ reseau: r, nom: RESEAUX.find((x) => x.id === r)?.nom ?? r }], comptesReseau).map((c) => (
              <label key={c.cle}>
                <input type="checkbox" name={`compte-${r}`} value={c.canalId} checked={!!c.canalId && !!comptes[r]?.includes(c.canalId)} onChange={(e) => c.canalId && basculerCompte(r, c.canalId, e.target.checked)} /> {c.libelle}
                {c.detail ? ` (${c.detail})` : ""}
              </label>
            )),
          )}
        </fieldset>
      )}

      <fieldset>
        <legend>2. Quel type ?</legend>
        {(Object.keys(TYPES_CONTENU) as TypeContenu[]).map((t) => (
          <label key={t}>
            <input type="radio" name="type" value={t} checked={typeContenu === t} onChange={() => setTypeContenu(t)} /> {TYPES_CONTENU[t].libelle}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>3. Le contenu</legend>
        <DepotMedia reseau={reseaux[0] ?? reseau} onMedia={setChoisi} />
        {proposer && <ProposerTexte type={typeContenu === "image" ? type : typeContenu} reseaux={reseaux.length ? reseaux : [reseau]} proposer={proposer} onChange={setTextes} />}
      </fieldset>

      <fieldset>
        <legend>4. Quand ?</legend>
        <label>Jour <input type="date" name="jour" value={jourSaisi} onChange={(e) => setJourSaisi(e.target.value)} /></label>
        <label>Heure (Paris) <input type="time" value={heure} onChange={(e) => setHeure(e.target.value)} /></label>
      </fieldset>

      <button type="submit" disabled={enCours}>Ajouter</button>
      {retour?.ok === false && retour.aConfirmer && (
        <p role="alert">{retour.avertissement} <button type="button" disabled={enCours} onClick={() => void envoyer(retour.aConfirmer)}>Ajouter quand même</button></p>
      )}
      {retour?.ok === false && !retour.aConfirmer && <p role="alert">{retour.message}</p>}
      {retour?.ok === true && <p role="status">{nombre > 1 ? `${nombre} publications ajoutées` : "Ajouté"} en « Proposée » : à valider avant tout envoi.{retour.avertissement ? ` ${retour.avertissement}` : ""}{nonEnvoye ? ` ${nonEnvoye}` : ""}</p>}
    </form>
  );
}
