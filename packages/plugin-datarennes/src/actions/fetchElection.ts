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
        // Fonction pour récupérer les données électorales
        async function fetchElectionData(limit: number = 100) {
            try {
                // URL de l'API
                const url = `https://data.rennesmetropole.fr/api/explore/v2.1/catalog/datasets/resultats_rennesmetropole_e24_1/records?limit=${limit}`;
                
                console.log(`Fetching election data from: ${url}`);
                
                const response = await fetch(url);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch election data: ${response.status} ${response.statusText}`);
                }
                
                const data = await response.json();
                
                if (!data.results || data.results.length === 0) {
                    return null;
                }
                
                console.log(`Successfully fetched ${data.results.length} election results`);
                
                return data.results;
            } catch (error) {
                console.error('Failed to fetch election data:', error);
                return null;
            }
        }
        
        // Extraire les paramètres de la question
        const context = `
        Analyze this message about election results: "${_message.content.text}"
        
        Extract the following information (if present):
        1. Commune name (e.g., "Rennes", "Saint-Jacques-de-la-Lande")
        2. Bureau de vote or polling station number/name (e.g., "bureau 115", "Collège Echange", "Gymnase Lesseps")
        3. Candidate name (e.g., "Glucksmann", "Bardella", "Hayer", "Valérie Hayer", "Maréchal")
        4. Any specific request like "participation rate", "turnout", "winner", "votes", "score", "liste des candidats", etc.
        
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
        
        // Récupérer les données
        const results = await fetchElectionData();
        
        if (!results) {
            return _callback({
                text: "Désolé, je n'ai pas pu récupérer les données électorales.",
                action: "FETCH_ELECTION_RESPONSE"
            });
        }
        
        // Traiter la demande en fonction des paramètres extraits
        let responseText = "";
        
        // Cas 1: Demande d'un candidat spécifique dans un bureau spécifique
        if (params.candidate && params.bureau) {
            responseText = getCandidateInBureau(results, params.candidate, params.bureau);
        }
        // Cas 2: Demande d'un candidat spécifique (tous bureaux)
        else if (params.candidate && !params.bureau) {
            responseText = getCandidateResults(results, params.candidate);
        }
        // Cas 3: Demande des résultats d'un bureau spécifique
        else if (params.bureau && !params.candidate) {
            responseText = getBureauResults(results, params.bureau);
        }
        // Cas 4: Demande de la liste des candidats
        else if (params.specificRequest && params.specificRequest.toLowerCase().includes("liste")) {
            responseText = getCandidatesList(results);
        }
        // Cas 5: Demande du taux de participation
        else if (params.specificRequest && (params.specificRequest.toLowerCase().includes("participation") || 
                                           params.specificRequest.toLowerCase().includes("taux"))) {
            responseText = getParticipationRate(results, params.bureau);
        }
        // Cas 6: Demande du vainqueur
        else if (params.specificRequest && (params.specificRequest.toLowerCase().includes("gagnant") || 
                                           params.specificRequest.toLowerCase().includes("vainqueur"))) {
            responseText = getWinner(results, params.bureau);
        }
        // Cas par défaut: résultats généraux
        else {
            responseText = getGeneralResults(results);
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
        
        // Fonctions utilitaires pour traiter les différents cas
        
        // Obtenir les résultats d'un candidat dans un bureau spécifique
        function getCandidateInBureau(results: any[], candidateName: string, bureauName: string): string {
            // Filtrer les résultats pour trouver le bureau
            const bureauResults = results.filter(result => {
                if (!result.nom_lieu) return false;
                return result.nom_lieu.toLowerCase().includes(bureauName.toLowerCase()) || 
                       result.numero_lieu === bureauName;
            });
            
            if (bureauResults.length === 0) {
                return `Aucun bureau de vote correspondant à "${bureauName}" n'a été trouvé.`;
            }
            
            // Pour chaque bureau trouvé, chercher le candidat
            for (const bureau of bureauResults) {
                for (let i = 1; i <= 38; i++) {
                    const currentName = bureau[`candidat_${i}`];
                    if (!currentName) continue;
                    
                    if (currentName.toLowerCase().includes(candidateName.toLowerCase())) {
                        const votes = bureau[`nb_voix_${i}`];
                        const percentage = bureau[`pourcentage_${i}`];
                        
                        if (votes !== undefined && percentage !== undefined) {
                            return `${currentName} a obtenu ${votes} voix (${percentage}%) au bureau de vote ${bureau.nom_lieu} (${bureau.numero_lieu}).`;
                        }
                    }
                }
            }
            
            return `Aucun résultat trouvé pour ${candidateName} au bureau ${bureauName}.`;
        }
        
        // Obtenir les résultats d'un candidat dans tous les bureaux
        function getCandidateResults(results: any[], candidateName: string): string {
            let totalVotes = 0;
            let totalPercentage = 0;
            let count = 0;
            let candidateFullName = "";
            
            // Calculer le total des voix pour ce candidat
            results.forEach(result => {
                for (let i = 1; i <= 38; i++) {
                    const currentName = result[`candidat_${i}`];
                    if (!currentName) continue;
                    
                    if (currentName.toLowerCase().includes(candidateName.toLowerCase())) {
                        const votes = result[`nb_voix_${i}`];
                        const percentage = result[`pourcentage_${i}`];
                        
                        if (votes !== undefined && percentage !== undefined) {
                            totalVotes += votes;
                            totalPercentage += percentage;
                            count++;
                            candidateFullName = currentName; // Garder le nom complet
                        }
                    }
                }
            });
            
            if (count === 0) {
                return `Aucun résultat trouvé pour ${candidateName}.`;
            }
            
            const avgPercentage = (totalPercentage / count).toFixed(2);
            return `${candidateFullName} a obtenu un total de ${totalVotes} voix (${avgPercentage}% en moyenne) sur ${count} bureaux de vote.`;
        }
        
        // Obtenir les résultats d'un bureau spécifique
        function getBureauResults(results: any[], bureauName: string): string {
            // Filtrer les résultats pour trouver le bureau
            const bureauResults = results.filter(result => {
                if (!result.nom_lieu) return false;
                return result.nom_lieu.toLowerCase().includes(bureauName.toLowerCase()) || 
                       result.numero_lieu === bureauName;
            });
            
            if (bureauResults.length === 0) {
                return `Aucun bureau de vote correspondant à "${bureauName}" n'a été trouvé.`;
            }
            
            // Pour chaque bureau trouvé, extraire les résultats des candidats
            const bureau = bureauResults[0]; // Prendre le premier bureau correspondant
            
            // Extraire les résultats des candidats
            const candidateResults = [];
            for (let i = 1; i <= 38; i++) {
                const candidateName = bureau[`candidat_${i}`];
                const votes = bureau[`nb_voix_${i}`];
                const percentage = bureau[`pourcentage_${i}`];
                
                if (candidateName && votes !== undefined && percentage !== undefined && votes > 0) {
                    candidateResults.push({
                        name: candidateName,
                        votes: votes,
                        percentage: percentage
                    });
                }
            }
            
            // Trier les candidats par nombre de voix (décroissant)
            candidateResults.sort((a, b) => b.votes - a.votes);
            
            // Formater la réponse
            let response = `Résultats au bureau de vote ${bureau.nom_lieu} (${bureau.numero_lieu}):\n\n`;
            
            // Ajouter les candidats
            candidateResults.forEach((candidate, index) => {
                response += `${index + 1}. ${candidate.name}: ${candidate.votes} voix (${candidate.percentage}%)\n`;
            });
            
            return response;
        }
        
        // Obtenir la liste des candidats
        function getCandidatesList(results: any[]): string {
            // Prendre le premier résultat pour extraire les noms des candidats
            const result = results[0];
            const candidates = [];
            
            // Extraire tous les noms de candidats
            for (let i = 1; i <= 38; i++) {
                const candidateName = result[`candidat_${i}`];
                if (candidateName) {
                    candidates.push(candidateName);
                }
            }
            
            return `Liste des candidats aux élections européennes 2024:\n\n${candidates.join('\n')}`;
        }
        
        // Obtenir le taux de participation
        function getParticipationRate(results: any[], bureauName: string | null): string {
            // Si un bureau est spécifié, filtrer les résultats
            let filteredResults = results;
            if (bureauName) {
                filteredResults = results.filter(result => {
                    if (!result.nom_lieu) return false;
                    return result.nom_lieu.toLowerCase().includes(bureauName.toLowerCase()) || 
                           result.numero_lieu === bureauName;
                });
                
                if (filteredResults.length === 0) {
                    return `Aucun bureau de vote correspondant à "${bureauName}" n'a été trouvé.`;
                }
            }
            
            // Calculer le taux de participation
            let totalInscrits = 0;
            let totalVotants = 0;
            
            filteredResults.forEach(result => {
                totalInscrits += result.nb_inscrits || 0;
                totalVotants += result.nb_emargements || 0;
            });
            
            const participationRate = totalInscrits > 0 ? (totalVotants / totalInscrits * 100).toFixed(2) : 0;
            
            if (bureauName) {
                return `Taux de participation au bureau de vote ${filteredResults[0].nom_lieu} (${filteredResults[0].numero_lieu}): ${participationRate}% (${totalVotants} votants sur ${totalInscrits} inscrits)`;
            } else {
                return `Taux de participation global: ${participationRate}% (${totalVotants} votants sur ${totalInscrits} inscrits)`;
            }
        }
        
        // Obtenir le vainqueur
        function getWinner(results: any[], bureauName: string | null): string {
            // Si un bureau est spécifié, filtrer les résultats
            let filteredResults = results;
            if (bureauName) {
                filteredResults = results.filter(result => {
                    if (!result.nom_lieu) return false;
                    return result.nom_lieu.toLowerCase().includes(bureauName.toLowerCase()) || 
                           result.numero_lieu === bureauName;
                });
                
                if (filteredResults.length === 0) {
                    return `Aucun bureau de vote correspondant à "${bureauName}" n'a été trouvé.`;
                }
            }
            
            // Pour chaque bureau, trouver le candidat avec le plus de voix
            const winners = filteredResults.map(result => {
                let maxVotes = 0;
                let winnerName = "";
                let winnerPercentage = 0;
                
                for (let i = 1; i <= 38; i++) {
                    const candidateName = result[`candidat_${i}`];
                    const votes = result[`nb_voix_${i}`];
                    const percentage = result[`pourcentage_${i}`];
                    
                    if (candidateName && votes !== undefined && percentage !== undefined && votes > maxVotes) {
                        maxVotes = votes;
                        winnerName = candidateName;
                        winnerPercentage = percentage;
                    }
                }
                
                return {
                    bureau: result.nom_lieu,
                    numero: result.numero_lieu,
                    winner: winnerName,
                    votes: maxVotes,
                    percentage: winnerPercentage
                };
            });
            
            if (bureauName) {
                const winner = winners[0];
                return `Le vainqueur au bureau de vote ${winner.bureau} (${winner.numero}) est ${winner.winner} avec ${winner.votes} voix (${winner.percentage}%)`;
            } else {
                // Compter les victoires par candidat
                const winnerCounts = {};
                winners.forEach(w => {
                    winnerCounts[w.winner] = (winnerCounts[w.winner] || 0) + 1;
                });
                
                // Trouver le candidat avec le plus de victoires
                let overallWinner = "";
                let maxWins = 0;
                for (const [candidate, count] of Object.entries(winnerCounts)) {
                    if (count > maxWins) {
                        maxWins = count as number;
                        overallWinner = candidate;
                    }
                }
                
                return `Le vainqueur global est ${overallWinner}, arrivé en tête dans ${maxWins} bureaux de vote sur ${filteredResults.length}.`;
            }
        }
        
        // Obtenir les résultats généraux
        function getGeneralResults(results: any[]): string {
            // Agréger les résultats par candidat
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
                                votes: 0
                            };
                        }
                        
                        candidateTotals[candidateName].votes += votes;
                    }
                }
            });
            
            // Calculer les pourcentages et trier les candidats
            const sortedCandidates = Object.entries(candidateTotals)
                .map(([name, data]: [string, any]) => ({
                    name,
                    votes: data.votes,
                    percentage: totalVotes > 0 ? (data.votes / totalVotes * 100).toFixed(2) : 0
                }))
                .sort((a, b) => b.votes - a.votes);
            
            // Formater la réponse
            let response = `Résultats globaux des élections européennes 2024 à Rennes:\n\n`;
            
            // Ajouter les 10 premiers candidats
            sortedCandidates.slice(0, 10).forEach((candidate, index) => {
                response += `${index + 1}. ${candidate.name}: ${candidate.votes} voix (${candidate.percentage}%)\n`;
            });
            
            return response;
        }
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
        [
            {
                user: "{{user1}}",
                content: { text: "Dans Gymnase Lesseps donne-moi le résultat de Mme HAYER Valérie" },
            },
            {
                user: "{{user2}}",
                content: { text: "", action: "FETCH_ELECTION" },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Donne-moi la liste des candidats aux élections européennes" },
            },
            {
                user: "{{user2}}",
                content: { text: "", action: "FETCH_ELECTION" },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: { text: "Combien a fait Maréchal Marion au collège échange?" },
            },
            {
                user: "{{user2}}",
                content: { text: "", action: "FETCH_ELECTION" },
            },
        ],
    ] as ActionExample[][],
} as Action;

export default fetchElectionAction;
