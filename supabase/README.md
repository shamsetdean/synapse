# Supabase — code serveur et migrations

Ce dossier existe pour que le code qui détient la clé privilégiée et écrit en
base soit versionné, relu et sauvegardé. Il ne l'était pas jusqu'au 6 août
2026 : les trois fonctions vivaient uniquement dans l'éditeur du Dashboard, et
les migrations SQL nulle part.

## Attention : le déploiement ne se fait pas depuis ce dossier

Les fonctions sont déployées **à la main, depuis l'éditeur du Dashboard
Supabase**, et les migrations exécutées **à la main, depuis le SQL Editor**.
Ce dossier en est le miroir, pas la source de déploiement.

Conséquence directe : **toute modification faite ici doit être reportée dans le
Dashboard, et toute modification faite dans le Dashboard doit être reportée
ici.** Sans cette discipline, les deux divergent silencieusement et ce dossier
donne une fausse assurance.

## Fonctions

Une par dossier, sous `functions/`. Le fichier d'entrée est nommé `index.ts`,
convention de l'outil en ligne de commande Supabase, en prévision d'un
déploiement automatisé futur. Dans le Dashboard, le fichier d'entrée de
`test-source` s'appelle en revanche `test-source.ts` : ne pas s'en étonner.

| Fonction | Rôle | Déclencheur |
|---|---|---|
| `test-source` | Vérifie une adresse de flux avant enregistrement | Formulaire d'ajout de source |
| `analyze-topic` | Collecte et rattache les articles à un sujet donné | Création d'un sujet |
| `ingestion-scheduler` | Collecte périodique de toutes les sources | Workflow GitHub Actions, toutes les 20 min |

### Secrets attendus

| Secret | Employé par | Effet s'il manque |
|---|---|---|
| `ALLOWED_ORIGINS` | `test-source`, `analyze-topic` | Aucun en-tête CORS émis, l'appel échoue depuis le navigateur |
| `INGEST_TOKEN` | `ingestion-scheduler` | La fonction refuse tout appel, l'ingestion s'arrête |

Un secret n'est lu qu'au démarrage de l'isolat : **après toute modification
d'un secret, redéployer les fonctions concernées**, sans quoi les instances
déjà chaudes conservent l'ancienne valeur.

## Migrations

Sous `migrations/`, nommées selon la convention `<horodatage>_<objet>.sql`.

Les deux migrations présentes ont **déjà été exécutées** en production le
6 août 2026. Elles sont conservées ici comme trace et comme moyen de
reconstituer l'état de sécurité de la base sur un nouvel environnement.

Elles sont écrites pour supporter une seconde exécution sans dommage :
`drop policy if exists` avant chaque création, `create or replace` sur les
fonctions, `revoke` et `grant` idempotents par nature.

## Ce qui n'est pas ici

Le schéma initial des tables, créé avant le 6 août 2026 et jamais versionné.
Ces deux migrations n'en couvrent que les correctifs de sécurité. Reconstituer
une base vierge depuis ce dossier n'est donc pas possible en l'état.
