import { Action, ActionExample, Content, HandlerCallback, IAgentRuntime, Memory, ModelClass, State, generateText, getEmbeddingZeroVector } from "@elizaos/core";

const fetchElectionAction: Action = {
    name: "FETCH_ELECTION",
    similes: ["ELECTION_DATA", "GET_ELECTION_RESULTS", "ELECTION_RESULTS", "VOTING_RESULTS"],
    validate: async (_runtime: IAgentRuntime, _message: Memory) => {
        return true;
    },
    description:
        "Get election results from Rennes Metropole's open data platform. Can retrieve results by commune, bureau de vote, or candidate.",
    handler: async (
        _runtime: IAgentRuntime,
        _message: Memory,
        _state: State,
        _options: { [key: string]: unknown; },
        _callback: HandlerCallback,
    ): Promise<boolean> => {
        async function fetchElectionData(query: string = '', limit: number = 50) {
            try {
                // Build the URL with query parameters if provided
                let url = `https://data.rennesmetropole.fr/api/explore/v2.1/catalog/datasets/resultats_rennesmetropole_e24_1/records?limit=${limit}`;
                
                if (query) {
                    url += `&where=${encodeURIComponent(query)}`;
                }
                
                console.log(`Fetching election data from: ${url}`);
                
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch election data: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                
                if (!data.results || data.results.length === 0) {
                    return "No election results found matching your query.";
                }
                
                console.log(`Successfully fetched ${data.results.length} election results`);
                
                return formatElectionResults(data.results);
            } catch (error) {
                console.error('Failed to fetch election data:', error);
                return 'Sorry, there was an error fetching the election data.';
            }
        }
        
        function formatElectionResults(results: any[]) {
            // Format the results in a readable way
            const formattedResults = results.map((result, index) => {
                // Extract basic information
                const basicInfo = [
                    `📊 Result ${index + 1}`,
                    '━━━━━━━━━━━━━━━━━━━━━━',
                    `🗳️ **${result.nom_election || 'Unknown Election'}** (Tour ${result.numero_tour || '?'})`,
                    `📅 Date: ${formatDate(result.date_election) || 'Unknown'}`,
                    `📍 Commune: ${result.libelle_commune || 'Unknown'} (${result.code_commune || '?'})`,
                    `🏢 Bureau de vote: ${result.nom_lieu || 'Unknown'} (${result.numero_lieu || '?'})`,
                    `📊 Participation: ${result.pourcentage_participation?.toFixed(2) || '?'}%`,
                    `👥 Inscrits: ${result.nb_inscrits || '?'} | Votants: ${result.nb_emargements || '?'} | Exprimés: ${result.nb_exprimes || '?'}`,
                    '\n📋 **Résultats par candidat:**'
                ].join('\n');
                
                // Extract candidate results
                const candidateResults = [];
                for (let i = 1; i <= 38; i++) {
                    const candidateName = result[`candidat_${i}`];
                    const votes = result[`nb_voix_${i}`];
                    const percentage = result[`pourcentage_${i}`];
                    
                    if (candidateName && votes !== undefined && percentage !== undefined) {
                        candidateResults.push(`- ${candidateName}: ${votes} voix (${percentage}%)`);
                    }
                }
                
                // Sort candidates by votes (descending)
                candidateResults.sort((a, b) => {
                    const votesA = parseInt(a.match(/: (\d+) voix/)?.[1] || '0');
                    const votesB = parseInt(b.match(/: (\d+) voix/)?.[1] || '0');
                    return votesB - votesA;
                });
                
                return `${basicInfo}\n${candidateResults.join('\n')}`;
            });
            
            return formattedResults.join('\n\n');
        }
        
        function formatDate(dateString: string | undefined) {
            if (!dateString) return 'Unknown';
            
            try {
                const date = new Date(dateString);
                return date.toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            } catch (e) {
                return dateString;
            }
        }
        
        // Extract query parameters from the user's message
        const context = `
        Analyze this message about election results: "${_message.content.text}"
        
        Extract the following information (if present):
        1. Commune name (e.g., "Rennes", "Saint-Jacques-de-la-Lande")
        2. Bureau de vote or polling station number/name (e.g., "bureau 115", "Collège Echange")
        3. Candidate name (e.g., "Glucksmann", "Bardella", "Hayer")
        4. Any specific request like "participation rate", "turnout", "winner", etc.
        
        Format your response as JSON:
        {
          "commune": "extracted commune or null if not mentioned",
          "bureau": "extracted bureau or null if not mentioned",
          "candidate": "extracted candidate or null if not mentioned",
          "specificRequest": "extracted specific request or null if not mentioned"
        }
        `;

        const extractedParams = await generateText({
            runtime: _runtime,
            context,
            modelClass: ModelClass.SMALL,
        });
        
        console.log("Extracted parameters:", extractedParams);
        
        let params;
        try {
            params = JSON.parse(extractedParams);
        } catch (e) {
            console.error("Failed to parse extracted parameters:", e);
            params = {};
        }
        
        // Build the query based on extracted parameters
        let queryParts = [];
        
        if (params.commune) {
            queryParts.push(`libelle_commune like "${params.commune}%"`);
        }
        
        if (params.bureau) {
            // Try to match either by bureau number or name
            if (/^\d+$/.test(params.bureau)) {
                queryParts.push(`numero_lieu = "${params.bureau}"`);
            } else {
                queryParts.push(`nom_lieu like "%${params.bureau}%"`);
            }
        }
        
        if (params.candidate) {
            // For candidates, we need to check all candidate fields (1-38)
            const candidateQueries = [];
            for (let i = 1; i <= 38; i++) {
                candidateQueries.push(`candidat_${i} like "%${params.candidate}%"`);
            }
            queryParts.push(`(${candidateQueries.join(" OR ")})`);
        }
        
        const query = queryParts.length > 0 ? queryParts.join(" AND ") : '';
        
        // Fetch the data
        const electionResults = await fetchElectionData(query);
        
        // Process specific requests if any
        let responseText = electionResults;
        if (params.specificRequest) {
            // Add a note about the specific request
            responseText += `\n\n**Note:** You asked about "${params.specificRequest}". The data above includes this information.`;
        }
        
        const newMemory: Memory = {
            userId: _message.agentId,
            agentId: _message.agentId,
            roomId: _message.roomId,
            content: {
                text: responseText,
                action: "FETCH_ELECTION_RESPONSE",
                source: _message.content?.source,
            } as Content,
            embedding: getEmbeddingZeroVector(),
        };

        await _runtime.messageManager.createMemory(newMemory);

        _callback(newMemory.content);
        return true;
    },
    examples: [
        [
            {
                user: "{{user1}}",
                content: { text: "Quels sont les résultats des élections européennes à Rennes?" },
            },
            {
                user: "{{user2}}",
                content: { text: "", action: "FETCH_ELECTION" },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Montre-moi les résultats du bureau de vote Collège Echange" },
            },
            {
                user: "{{user2}}",
                content: { text: "", action: "FETCH_ELECTION" },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Combien de voix a obtenu Glucksmann à Rennes?" },
            },
            {
                user: "{{user2}}",
                content: { text: "", action: "FETCH_ELECTION" },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Quel est le taux de participation aux élections européennes à Rennes?" },
            },
            {
                user: "{{user2}}",
                content: { text: "", action: "FETCH_ELECTION" },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Qui a gagné les élections européennes au bureau 115?" },
            },
            {
                user: "{{user2}}",
                content: { text: "", action: "FETCH_ELECTION" },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Donne-moi les résultats du bureau de vote Jules Isaac" },
            },
            {
                user: "{{user2}}",
                content: { text: "", action: "FETCH_ELECTION" },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Quels sont les scores de Bardella et Hayer à Rennes?" },
            },
            {
                user: "{{user2}}",
                content: { text: "", action: "FETCH_ELECTION" },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Montre-moi les résultats des élections dans le canton RENNES-1" },
            },
            {
                user: "{{user2}}",
                content: { text: "", action: "FETCH_ELECTION" },
            },
        ],
    ] as ActionExample[][],
} as Action;

export default fetchElectionAction;
