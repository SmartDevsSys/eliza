import { ElizaContext } from '@elizaos/core';

/**
 * Represents an election result from the Rennes Metropole API
 */
export interface ElectionResult {
  code_election: string;
  nom_election: string;
  numero_tour: number;
  date_election: string;
  code_commune: number;
  libelle_commune: string;
  num_centre: number;
  niveau_detail: string;
  numero_lieu: string;
  nom_lieu: string;
  adresse_lieu: string | null;
  numero_canton: number;
  nom_canton: string;
  numero_circonscription: number;
  nom_circonscription: string;
  nb_inscrits: number;
  nb_emargements: number;
  nb_bulletins: number;
  nb_blanc: number;
  nb_nuls: number;
  nb_exprimes: number;
  pourcentage_participation: number;
  valid: string;
  // Candidate information (dynamic fields for candidates 1-30)
  [key: string]: string | number | null;
}

/**
 * Plugin configuration options
 */
export interface PluginConfig {
  apiBaseUrl?: string;
  defaultLimit?: number;
}
