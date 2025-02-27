import { ElizaContext, Action } from '@elizaos/core';
import fetch from 'node-fetch';
import { ElectionResult } from '../types';

/**
 * Fetches election data from the Rennes Metropole API
 * @param ctx - The Eliza context
 * @param limit - The maximum number of results to return (default: 20)
 * @returns The election data
 */
const fetchElectionData = async (
  ctx: ElizaContext,
  limit: number = 20
): Promise<{ total_count: number; results: ElectionResult[] }> => {
  try {
    const url = `https://data.rennesmetropole.fr/api/explore/v2.1/catalog/datasets/resultats_rennesmetropole_e24_1/records?limit=${limit}`;

    ctx.log.info(`Fetching election data from ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch election data: ${response.statusText}`);
    }

    const data = await response.json() as { total_count: number; results: ElectionResult[] };

    ctx.log.info(`Successfully fetched ${data.results.length} election results`);

    return data;
  } catch (error) {
    ctx.log.error('Error fetching election data:', error);
    throw error;
  }
};

const fetchElection: Action = {
  name: 'fetchElection',
  description: 'Fetches election data from Rennes Metropole.',
  similes: ['get election results', 'show election data'],
  examples: [
    [
      {
        user: 'user',
        content: {
          text: 'Get the latest election results',
        },
      },
    ],
  ],
  handler: fetchElectionData,
  validate: async () => true,
};

export default fetchElection;
