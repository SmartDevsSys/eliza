# Legislators Data Import for Supabase

This directory contains scripts to import French legislators data from a CSV file into a Supabase database for use with the ElizaOS Supabase adapter.

## Prerequisites

- Node.js and npm installed
- Supabase account and project
- Supabase URL and anonymous key

## Files

- `import-legislators-to-supabase.js`: Main script that reads the CSV file and imports data to Supabase
- `package.json`: Node.js package configuration
- `run-import.sh`: Shell script for Unix/Linux/macOS to run the import
- `run-import.bat`: Batch script for Windows to run the import

## How to Use

### 1. Set up Supabase

1. Create a Supabase project at https://supabase.com
2. Run the schema migration by executing the SQL in `packages/adapter-supabase/schema.sql`
3. Run the seed SQL in `packages/adapter-supabase/seed.sql`
4. Get your Supabase URL and anonymous key from the project settings

### 2. Run the Import Script

#### On Windows:

```
scripts\run-import.bat
```

#### On Unix/Linux/macOS:

```
chmod +x scripts/run-import.sh
./scripts/run-import.sh
```

The script will:
1. Install the required dependencies
2. Prompt for your Supabase URL and anonymous key if not set as environment variables
3. Import the legislators data from `data/data1.csv` into your Supabase database

### 3. Configure the Character

Add the Supabase adapter to your character configuration:

```json
{
  "plugins": ["@elizaos-plugins/adapter-supabase"],
  "settings": {
    "secrets": {
      "SUPABASE_URL": "your-supabase-project-url",
      "SUPABASE_ANON_KEY": "your-supabase-anon-key"
    }
  }
}
```

## Data Structure

The script imports the legislators data into the following Supabase tables:

1. `accounts`: Each legislator is stored as an account with the following fields:
   - `id`: UUID generated for each legislator
   - `name`: Full name (first name + last name)
   - `username`: Legislator ID from the CSV
   - `email`: Email address from the CSV or generated if not available
   - `details`: JSON object containing all other fields from the CSV

2. `rooms`: A single room is created to group all legislators
   - `id`: UUID generated for the room

3. `participants`: Links legislators to the room
   - `userId`: Legislator's account ID
   - `roomId`: Room ID

## Troubleshooting

- If you encounter errors related to missing dependencies, run `npm install` in the `scripts` directory
- If you get database connection errors, check your Supabase URL and anonymous key
- If you see data insertion errors, ensure your Supabase database has the correct schema
