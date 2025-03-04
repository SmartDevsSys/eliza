# Import des Législateurs vers Supabase

Ce dossier contient les scripts nécessaires pour importer les données des législateurs français depuis le fichier CSV vers une base de données Supabase pour utilisation avec l'adaptateur Supabase d'ElizaOS.

## Fichiers

- `data1.csv` : Fichier CSV contenant les données des législateurs
- `import-legislators-to-supabase.js` : Script principal qui lit le fichier CSV et importe les données vers Supabase
- `package.json` : Configuration du package Node.js
- `run-import.sh` : Script shell pour Unix/Linux/macOS
- `run-import.bat` : Script batch pour Windows

## Instructions d'utilisation

### 1. Créer un projet Supabase
1. Allez sur https://supabase.com et créez un compte si vous n'en avez pas déjà un
2. Créez un nouveau projet
3. Notez l'URL du projet et la clé anonyme (anon key) qui se trouvent dans Paramètres du projet > API

### 2. Configurer la base de données Supabase
1. Dans votre projet Supabase, allez dans l'éditeur SQL
2. Copiez et exécutez le contenu du fichier `packages/adapter-supabase/schema.sql`
3. Copiez et exécutez le contenu du fichier `packages/adapter-supabase/seed.sql`

### 3. Configurer le caractère Jeanne
1. Ouvrez le fichier `characters/jeanne.character.json`
2. Remplacez "your-supabase-project-url" par l'URL de votre projet Supabase
3. Remplacez "your-supabase-anon-key" par la clé anonyme de votre projet Supabase
4. Sauvegardez le fichier

### 4. Exécuter le script d'importation
1. Ouvrez une invite de commande (cmd) ou PowerShell
2. Naviguez vers le dossier `data` du projet ElizaOS
3. Exécutez le script d'importation :
   ```
   run-import.bat
   ```
   (ou `./run-import.sh` sur Unix/Linux/macOS)

Le script va :
1. Installer les dépendances nécessaires
2. Vous demander l'URL et la clé anonyme de votre projet Supabase si elles ne sont pas définies comme variables d'environnement
3. Importer les données des législateurs depuis `data1.csv` vers votre base de données Supabase

### 5. Vérifier l'importation
1. Retournez sur votre projet Supabase
2. Allez dans Table Editor
3. Vérifiez que les tables `accounts`, `rooms` et `participants` contiennent les données des législateurs
