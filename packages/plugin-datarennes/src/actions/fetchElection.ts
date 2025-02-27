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
                
                return formatElectionResults(data.results, params);
            } catch (error) {
                console.error('Failed to fetch election data:', error);
                return 'Sorry, there was an error fetching the election data.';
            }
        }
        
        function formatElectionResults(results: any[], params: any) {
            // Determine the type of query based on extracted parameters
            const queryType = determineQueryType(params);
            
            switch (queryType) {
                case 'CANDIDATE_VOTES':
                    return formatCandidateVotes(results, params.candidate);
                case 'PARTICIPATION_RATE':
                    return formatParticipationRate(results);
                case 'WINNER':
                    return formatWinner(results);
                case 'BUREAU_RESULTS':
                    return formatBureauResults(results);
                case 'COMMUNE_RESULTS':
                    return formatCommuneResults(results);
                case 'CANDIDATE_COMPARISON':
                    return formatCandidateComparison(results, params);
                default:
                    return formatDetailedResults(results);
            }
        }
        
        function determineQueryType(params: any): string {
            // Check for specific request types
            if (params.specificRequest) {
                const request = params.specificRequest.toLowerCase();
                if (request.includes('participation') || request.includes('taux')) {
                    return 'PARTICIPATION_RATE';
                }
                if (request.includes('gagnant') || request.includes('gagné') || request.includes('vainqueur') || request.includes('winner')) {
                    return 'WINNER';
                }
            }
            
            // Check for candidate-specific queries
            if (params.candidate) {
                // If we have multiple candidates, it's a comparison
                if (params.candidate.includes(',') || params.candidate.includes(' et ') || params.candidate.includes(' and ')) {
                    return 'CANDIDATE_COMPARISON';
                }
                return 'CANDIDATE_VOTES';
            }
            
            // Check for bureau-specific queries
            if (params.bureau && !params.commune) {
                return 'BUREAU_RESULTS';
            }
            
            // Check for commune-specific queries
            if (params.commune && !params.bureau) {
                return 'COMMUNE_RESULTS';
            }
            
            // Default to detailed results
            return 'DETAILED_RESULTS';
        }
        
        function formatCandidateVotes(results: any[], candidateName: string): string {
            if (results.length === 0) {
                return `Aucun résultat trouvé pour ${candidateName}.`;
            }
            
            let totalVotes = 0;
            let totalPercentage = 0;
            let count = 0;
            const detailedResults = [];
            
            // Process each result
            results.forEach(result => {
                // Find the candidate in this result
                for (let i = 1; i <= 38; i++) {
                    const currentName = result[`candidat_${i}`];
                    if (currentName && currentName.toLowerCase().includes(candidateName.toLowerCase())) {
                        const votes = result[`nb_voix_${i}`];
                        const percentage = result[`pourcentage_${i}`];
                        
                        if (votes !== undefined && percentage !== undefined) {
                            totalVotes += votes;
                            totalPercentage += percentage;
                            count++;
                            
                            detailedResults.push({
                                commune: result.libelle_commune,
                                bureau: result.nom_lieu,
                                numero: result.numero_lieu,
                                votes: votes,
                                percentage: percentage
                            });
                        }
                    }
                }
            });
            
            if (count === 0) {
                return `Aucun résultat trouvé pour ${candidateName}.`;
            }
            
            // Format the response
            const avgPercentage = (totalPercentage / count).toFixed(2);
            
            let response = `📊 **Résultats pour ${candidateName}**\n\n`;
            response += `Total des voix: **${totalVotes}**\n`;
            response += `Pourcentage moyen: **${avgPercentage}%**\n`;
            
            if (detailedResults.length > 1) {
                response += `\nRésultats détaillés par bureau de vote:\n`;
                detailedResults.forEach(detail => {
                    response += `- ${detail.commune}, ${detail.bureau} (${detail.numero}): ${detail.votes} voix (${detail.percentage}%)\n`;
                });
            }
            
            return response;
        }
        
        function formatParticipationRate(results: any[]): string {
            if (results.length === 0) {
                return "Aucun résultat trouvé pour calculer le taux de participation.";
            }
            
            let totalInscrits = 0;
            let totalVotants = 0;
            const participationByBureau = [];
            
            // Calculate overall participation
            results.forEach(result => {
                totalInscrits += result.nb_inscrits || 0;
                totalVotants += result.nb_emargements || 0;
                
                participationByBureau.push({
                    commune: result.libelle_commune,
                    bureau: result.nom_lieu,
                    numero: result.numero_lieu,
                    inscrits: result.nb_inscrits,
                    votants: result.nb_emargements,
                    participation: result.pourcentage_participation
                });
            });
            
            const overallParticipation = totalInscrits > 0 ? (totalVotants / totalInscrits * 100).toFixed(2) : 0;
            
            // Format the response
            let response = `📊 **Taux de participation**\n\n`;
            response += `Participation globale: **${overallParticipation}%** (${totalVotants} votants sur ${totalInscrits} inscrits)\n`;
            
            if (participationByBureau.length > 1) {
                response += `\nDétail par bureau de vote:\n`;
                participationByBureau.forEach(bureau => {
                    response += `- ${bureau.commune}, ${bureau.bureau} (${bureau.numero}): ${bureau.participation?.toFixed(2) || 0}%\n`;
                });
            }
            
            return response;
        }
        
        function formatWinner(results: any[]): string {
            if (results.length === 0) {
                return "Aucun résultat trouvé pour déterminer le vainqueur.";
            }
            
            // Process each result to find winners
            const winners = results.map(result => {
                let maxVotes = 0;
                let winnerName = "";
                let winnerPercentage = 0;
                
                // Find the candidate with the most votes
                for (let i = 1; i <= 38; i++) {
                    const candidateName = result[`candidat_${i}`];
                    const votes = result[`nb_voix_${i}`] as number;
                    const percentage = result[`pourcentage_${i}`];
                    
                    if (candidateName && votes !== undefined && votes > maxVotes) {
                        maxVotes = votes;
                        winnerName = candidateName;
                        winnerPercentage = percentage;
                    }
                }
                
                return {
                    commune: result.libelle_commune,
                    bureau: result.nom_lieu,
                    numero: result.numero_lieu,
                    winner: winnerName,
                    votes: maxVotes,
                    percentage: winnerPercentage
                };
            });
            
            // Format the response
            let response = `🏆 **Résultats des vainqueurs**\n\n`;
            
            if (winners.length === 1) {
                const winner = winners[0];
                response += `À ${winner.commune}, ${winner.bureau} (${winner.numero}), le vainqueur est **${winner.winner}** avec ${winner.votes} voix (${winner.percentage}%)`;
            } else {
                // Count overall winners
                const winnerCounts = {};
                winners.forEach(w => {
                    winnerCounts[w.winner] = (winnerCounts[w.winner] || 0) + 1;
                });
                
                // Find the overall winner
                let overallWinner = "";
                let maxWins = 0;
                for (const [candidate, count] of Object.entries(winnerCounts)) {
                    if (count > maxWins) {
                        maxWins = count as number;
                        overallWinner = candidate;
                    }
                }
                
                response += `Sur l'ensemble des ${winners.length} bureaux de vote, **${overallWinner}** arrive en tête dans ${maxWins} bureaux.\n\n`;
                response += `Détail par bureau de vote:\n`;
                winners.forEach(w => {
                    response += `- ${w.commune}, ${w.bureau} (${w.numero}): **${w.winner}** avec ${w.votes} voix (${w.percentage}%)\n`;
                });
            }
            
            return response;
        }
        
        function formatBureauResults(results: any[]): string {
            if (results.length === 0) {
                return "Aucun résultat trouvé pour ce bureau de vote.";
            }
            
            // Since we're filtering by bureau, we should have just one result
            const result = results[0];
            
            // Format basic information
            let response = [
                `📊 **Résultats électoraux - ${result.nom_lieu} (${result.numero_lieu})**`,
                `🗳️ ${result.nom_election} (Tour ${result.numero_tour})`,
                `📅 Date: ${formatDate(result.date_election)}`,
                `📍 Commune: ${result.libelle_commune} (${result.code_commune})`,
                `📊 Participation: ${result.pourcentage_participation?.toFixed(2) || '?'}%`,
                `👥 Inscrits: ${result.nb_inscrits || '?'} | Votants: ${result.nb_emargements || '?'} | Exprimés: ${result.nb_exprimes || '?'}`,
                '\n**Résultats par candidat:**'
            ].join('\n');
            
            // Extract and sort candidate results
            const candidateResults = [];
            for (let i = 1; i <= 38; i++) {
                const candidateName = result[`candidat_${i}`];
                const votes = result[`nb_voix_${i}`];
                const percentage = result[`pourcentage_${i}`];
                
                if (candidateName && votes !== undefined && percentage !== undefined) {
                    candidateResults.push({
                        name: candidateName,
                        votes: votes,
                        percentage: percentage
                    });
                }
            }
            
            // Sort by votes (descending)
            candidateResults.sort((a, b) => b.votes - a.votes);
            
            // Add top 5 candidates with emphasis
            response += '\n\n**Top 5 candidats:**\n';
            for (let i = 0; i < Math.min(5, candidateResults.length); i++) {
                const candidate = candidateResults[i];
                response += `${i+1}. **${candidate.name}**: ${candidate.votes} voix (${candidate.percentage}%)\n`;
            }
            
            // Add remaining candidates
            if (candidateResults.length > 5) {
                response += '\nAutres candidats:\n';
                for (let i = 5; i < candidateResults.length; i++) {
                    const candidate = candidateResults[i];
                    response += `- ${candidate.name}: ${candidate.votes} voix (${candidate.percentage}%)\n`;
                }
            }
            
            return response;
        }
        
        function formatCommuneResults(results: any[]): string {
            if (results.length === 0) {
                return "Aucun résultat trouvé pour cette commune.";
            }
            
            // Get commune name from first result
            const commune = results[0].libelle_commune;
            
            // Aggregate results by candidate across all bureaux
            const candidateTotals = {};
            let totalVotes = 0;
            
            results.forEach(result => {
                totalVotes += result.nb_exprimes || 0;
                
                for (let i = 1; i <= 38; i++) {
                    const candidateName = result[`candidat_${i}`];
                    const votes = result[`nb_voix_${i}`] || 0;
                    
                    if (candidateName) {
                        if (!candidateTotals[candidateName]) {
                            candidateTotals[candidateName] = {
                                votes: 0,
                                bureaux: 0
                            };
                        }
                        
                        candidateTotals[candidateName].votes += votes;
                        candidateTotals[candidateName].bureaux += 1;
                    }
                }
            });
            
            // Calculate percentages and sort candidates
            const sortedCandidates = Object.entries(candidateTotals)
                .map(([name, data]: [string, any]) => ({
                    name,
                    votes: data.votes,
                    percentage: totalVotes > 0 ? (data.votes / totalVotes * 100).toFixed(2) : 0,
                    bureaux: data.bureaux
                }))
                .sort((a, b) => b.votes - a.votes);
            
            // Format the response
            let response = `📊 **Résultats électoraux - ${commune}**\n\n`;
            response += `Nombre de bureaux de vote: ${results.length}\n`;
            response += `Total des votes exprimés: ${totalVotes}\n\n`;
            
            response += `**Top 5 candidats:**\n`;
            for (let i = 0; i < Math.min(5, sortedCandidates.length); i++) {
                const candidate = sortedCandidates[i];
                response += `${i+1}. **${candidate.name}**: ${candidate.votes} voix (${candidate.percentage}%)\n`;
            }
            
            if (sortedCandidates.length > 5) {
                response += '\n**Autres candidats:**\n';
                for (let i = 5; i < sortedCandidates.length; i++) {
                    const candidate = sortedCandidates[i];
                    if (candidate.votes > 0) {
                        response += `- ${candidate.name}: ${candidate.votes} voix (${candidate.percentage}%)\n`;
                    }
                }
            }
            
            return response;
        }
        
        function formatCandidateComparison(results: any[], params: any): string {
            if (results.length === 0) {
                return "Aucun résultat trouvé pour comparer les candidats.";
            }
            
            // Parse candidate names
            let candidateNames = params.candidate.split(/,|\set\s|\sand\s/);
            candidateNames = candidateNames.map(name => name.trim());
            
            // Aggregate results for each candidate
            const candidateData = {};
            
            results.forEach(result => {
                for (let i = 1; i <= 38; i++) {
                    const currentName = result[`candidat_${i}`];
                    if (!currentName) continue;
                    
                    // Check if this candidate matches any of our search terms
                    const matchedCandidate = candidateNames.find(name => 
                        currentName.toLowerCase().includes(name.toLowerCase())
                    );
                    
                    if (matchedCandidate) {
                        if (!candidateData[currentName]) {
                            candidateData[currentName] = {
                                votes: 0,
                                bureaux: 0,
                                totalPercentage: 0
                            };
                        }
                        
                        candidateData[currentName].votes += result[`nb_voix_${i}`] || 0;
                        candidateData[currentName].bureaux += 1;
                        candidateData[currentName].totalPercentage += result[`pourcentage_${i}`] || 0;
                    }
                }
            });
            
            // Format the comparison
            let response = `📊 **Comparaison des candidats**\n\n`;
            
            if (Object.keys(candidateData).length === 0) {
                return "Aucun des candidats spécifiés n'a été trouvé dans les résultats.";
            }
            
            // Sort candidates by votes
            const sortedCandidates = Object.entries(candidateData)
                .map(([name, data]: [string, any]) => ({
                    name,
                    votes: data.votes,
                    bureaux: data.bureaux,
                    avgPercentage: (data.totalPercentage / data.bureaux).toFixed(2)
                }))
                .sort((a, b) => b.votes - a.votes);
            
            // Create comparison table
            sortedCandidates.forEach(candidate => {
                response += `**${candidate.name}**:\n`;
                response += `- Total des voix: ${candidate.votes}\n`;
                response += `- Pourcentage moyen: ${candidate.avgPercentage}%\n`;
                response += `- Présent dans ${candidate.bureaux} bureaux de vote\n\n`;
            });
            
            // Add winner statement
            if (sortedCandidates.length > 1) {
                const winner = sortedCandidates[0];
                const runnerUp = sortedCandidates[1];
                const difference = winner.votes - runnerUp.votes;
                
                response += `**${winner.name}** devance **${runnerUp.name}** de ${difference} voix.`;
            }
            
            return response;
        }
        
        function formatDetailedResults(results: any[]): string {
            if (results.length === 0) {
                return "Aucun résultat trouvé.";
            }
            
            // For detailed results, limit to a reasonable number
            const limitedResults = results.slice(0, 3);
            
            const formattedResults = limitedResults.map((result, index) => {
                // Extract basic information
                const basicInfo = [
                    `📊 Résultat ${index + 1}`,
                    '━━━━━━━━━━━━━━━━━━━━━━',
                    `🗳️ **${result.nom_election || 'Élection inconnue'}** (Tour ${result.numero_tour || '?'})`,
                    `📅 Date: ${formatDate(result.date_election) || 'Inconnue'}`,
                    `📍 Commune: ${result.libelle_commune || 'Inconnue'} (${result.code_commune || '?'})`,
                    `🏢 Bureau de vote: ${result.nom_lieu || 'Inconnu'} (${result.numero_lieu || '?'})`,
                    `📊 Participation: ${result.pourcentage_participation?.toFixed(2) || '?'}%`,
                    `👥 Inscrits: ${result.nb_inscrits || '?'} | Votants: ${result.nb_emargements || '?'} | Exprimés: ${result.nb_exprimes || '?'}`,
                    '\n📋 **Top 5 candidats:**'
                ].join('\n');
                
                // Extract candidate results
                const candidateResults = [];
                for (let i = 1; i <= 38; i++) {
                    const candidateName = result[`candidat_${i}`];
                    const votes = result[`nb_voix_${i}`];
                    const percentage = result[`pourcentage_${i}`];
                    
                    if (candidateName && votes !== undefined && percentage !== undefined) {
                        candidateResults.push({
                            name: candidateName,
                            votes: votes,
                            percentage: percentage
                        });
                    }
                }
                
                // Sort candidates by votes (descending)
                candidateResults.sort((a, b) => b.votes - a.votes);
                
                // Format top 5 candidates
                const topCandidates = candidateResults.slice(0, 5).map((c, i) => 
                    `${i+1}. **${c.name}**: ${c.votes} voix (${c.percentage}%)`
                ).join('\n');
                
                return `${basicInfo}\n${topCandidates}`;
            });
            
            let response = formattedResults.join('\n\n');
            
            if (results.length > 3) {
                response += `\n\n*${results.length - 3} autres résultats trouvés. Posez une question plus spécifique pour des résultats plus précis.*`;
            }
            
            return response;
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
