# DataRennes Plugin for ElizaOS

A plugin for ElizaOS that fetches data from the Rennes Metropole open data platform.

## Features

- Fetch European election 2024 results from Rennes Metropole
- Get election data for specific communes
- Configure result limits
- Extensible design to support other data types from Rennes Metropole APIs

## Installation

This plugin is installed as part of the Jeanne character in ElizaOS.

## Usage

Example commands:
- "Show me the election results for Rennes"
- "What were the European election results in 2024?"
- "Show election data for commune 238"

## API Endpoint

The plugin currently uses the following API endpoint:
https://data.rennesmetropole.fr/api/explore/v2.1/catalog/datasets/resultats_rennesmetropole_e24_1/records

## Extending the Plugin

To add support for additional data from Rennes Metropole, create new action files in the src/actions directory and import/register them in the index.ts file.
