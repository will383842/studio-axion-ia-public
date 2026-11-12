# CAL-19 — règles par réseau modifiables dans Réglages
- Fait : `src/domaine/cadence/reglages.ts` porte maintenant, par réseau, quatre règles (longueur du texte, nombre de mots-dièse, 1 PDF pour le carrousel LinkedIn, premier commentaire à 3 états : part tout seul / après accord / à la main). Chaque règle a sa valeur, sa date de vérification (ou « pas encore vérifiée ») et sa source. Valeurs de départ : registre des réseaux ; datées et sourcées par le relevé L8-01 (2026-11-12) quand il les prouve (PDF LinkedIn, premier commentaire, texte TikTok).
- `controlerTexteSelonRegles` : le contrôle lit les règles enregistrées (paramètres), donc une règle modifiée change le contrôle sans redéploiement. Avertit seulement, ne bloque jamais.
- Page Réglages › Cadence : un seul formulaire (action écrite dans la page) pour heures, quota, écart et règles. Si une valeur change : source « Modifiée par vous », date du jour.
- Test : `tests/calendrier/cal-19-regles-reseau.test.ts` (écrit rouge d'abord, 4 verts). Tests cadence et calendrier : 632 verts. eslint sans erreur ; tsc : aucune erreur sur les fichiers touchés (erreurs déjà présentes ailleurs, modules `remotion` et types Next générés).
- MANQUE (liste de fichiers trop courte, non élargie) :
  1. `src/app/(studio)/reglages/cadence/actions.ts` : `enregistrerCadenceFormulaire` n'est plus appelée par la page ; si elle l'était ailleurs, elle effacerait les règles (elle ne conserve que les objectifs). À supprimer ou aligner.
  2. Le contrôle réel du texte (`src/services/controle-programmation.ts`, `src/domaine/controles-script/texte-post.ts`) lit encore le registre figé : à brancher sur `controlerTexteSelonRegles` dans une fiche suivante.
  3. Pas de maquette dédiée aux règles dans `calendrier-du-studio.html` : la page suit le style des Réglages existants.
- Aucun appel réel, aucun fichier de la zone Zernio touché.
