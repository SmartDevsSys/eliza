#!/bin/bash

# Change to the scripts directory
cd "$(dirname "$0")"

# Install dependencies
echo "Installing dependencies..."
npm install

# Check if Supabase credentials are provided
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "Please provide Supabase credentials:"
  
  # Prompt for Supabase URL if not set
  if [ -z "$SUPABASE_URL" ]; then
    read -p "Enter your Supabase URL: " SUPABASE_URL
    export SUPABASE_URL
  fi
  
  # Prompt for Supabase Anon Key if not set
  if [ -z "$SUPABASE_ANON_KEY" ]; then
    read -p "Enter your Supabase Anon Key: " SUPABASE_ANON_KEY
    export SUPABASE_ANON_KEY
  fi
fi

# Run the import script
echo "Running import script..."
npm run import

echo "Import process completed."
