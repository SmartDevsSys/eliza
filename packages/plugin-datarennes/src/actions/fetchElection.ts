import { Action, ActionExample, Content, HandlerCallback, IAgentRuntime, Memory, ModelClass, State, generateText, getEmbeddingZeroVector } from "@elizaos/core";

// Fonction utilitaire pour normaliser une chaîne de caractères (minuscules, suppression des accents, espaces en trop)
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

const fetchElectionAction: Action = {
  name: "FETCH_ELECTION",
  similes: ["ELECTION_DATA", "GET_ELECTION_RESULTS", "ELECTION_RESULTS", "VOTING_RESULTS"],
  validate: async (_runtime: IAgentRuntime, _message: Memory) => true,
  description:
    "Récupère les résultats électoraux depuis l'API open data de Rennes Metropole. Possibilité de filtrer par commune, bureau de vote ou candidat.",
  handler: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
    _options: { [key: string]: unknown },
    _callback: HandlerCallback,
  ): Promise<boolean> => {
    // Fonction pour récupérer les données électorales
    async function fetchElectionData(limit: number = 100): Promise<any[] | null> {
      const url = `https://data.rennesmetropole.fr/api/explore/v2.1/catalog/datasets/resultats_rennesmetropole_e24_1/records?limit=${limit}`;
      console.log(`Fetching election data from: ${url}`);
      try {
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
        console.error("Failed to fetch election data:", error);
        return null;
      }
    }

    // Extraction des paramètres depuis le message utilisateur avec Mistral
    const context = `
Analyse le message suivant concernant les résultats électoraux : "${_message.content.text}"
Extrais les informations suivantes (si présentes) et renvoie un JSON valide :
- "commune" : le nom de la commune (ex: "Rennes")
- "bureau" : le nom ou numéro du bureau de vote (ex: "Collège Echange", "bureau 115")
- "candidate" : le nom du candidat (ex: "Glucksmann", "Maréchal")
- "specificRequest" : une requête spécifique (ex: "taux de participation", "gagnant", "liste des candidats")
Exemple de réponse :
{
  "commune": "rennes",
  "bureau": null,
  "candidate": "glucksmann",
  "specificRequest": null
}`;
    const extractedParamsText = await generateText({
      runtime: _runtime,
      context: context, // Utilisation de la variable de contexte pour Mistral
      modelClass: ModelClass.LARGE, // Utilisation du modèle Mistral (Large)
    });
    console.log("Extracted parameters:", extractedParamsText);

    let params: { commune?: string; bureau?: string; candidate?: string; specificRequest?: string } = {};
    try {
      params = JSON.parse(extractedParamsText);
    } catch (e) {
      console.error("Erreur lors du parsing des paramètres extraits :", e);
      params = {};
    }
    // Normalisation des paramètres extraits
    if (params.commune) params.commune = normalize(params.commune);
    if (params.bureau) params.bureau = normalize(params.bureau);
    if (params.candidate) params.candidate = normalize(params.candidate);
    if (params.specificRequest) params.specificRequest = normalize(params.specificRequest);

    // Récupérer les données électorales
    const results = await fetchElectionData();
    if (!results) {
      return _callback({
        text: "Désolé, je n'ai pas pu récupérer les données électorales.",
        action: "FETCH_ELECTION_RESPONSE",
      });
    }

    // Filtrer par commune si le paramètre est précisé
    let filteredResults = results;
    if (params.commune) {
      filteredResults = results.filter(
        (result) => result.libelle_commune && normalize(result.libelle_commune).includes(params.commune as string)
      );
      if (filteredResults.length === 0) {
        return _callback({
          text: `Aucune donnée trouvée pour la commune "${params.commune}".`,
          action: "FETCH_ELECTION_RESPONSE",
        });
      }
    }

    // Choix de la fonction de traitement selon les paramètres extraits
    let responseText = "";
    if (params.candidate && params.bureau) {
      responseText = getCandidateInBureau(filteredResults, params.candidate, params.bureau);
    } else if (params.candidate) {
      responseText = getCandidateResults(filteredResults, params.candidate);
    } else if (params.bureau) {
      responseText = getBureauResults(filteredResults, params.bureau);
    } else if (params.specificRequest && params.specificRequest.includes("liste")) {
      responseText = getCandidatesList(filteredResults);
    } else if (params.specificRequest && (params.specificRequest.includes("participation") || params.specificRequest.includes("taux"))) {
      responseText = getParticipationRate(filteredResults, params.bureau || null);
    } else if (params.specificRequest && (params.specificRequest.includes("gagnant") || params.specificRequest.includes("vainqueur"))) {
      responseText = getWinner(filteredResults, params.bureau || null);
    } else {
      responseText = getGeneralResults(filteredResults);
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

    // --- Fonctions utilitaires pour traiter les cas spécifiques ---

    // 1. Résultats d'un candidat dans un bureau précis
    function getCandidateInBureau(results: any[], candidateName: string, bureauName: string): string {
      candidateName = normalize(candidateName);
      bureauName = normalize(bureauName);

      const bureauResults = results.filter(
        (result) =>
          result.nom_lieu &&
          (normalize(result.nom_lieu).includes(bureauName) || result.numero_lieu === bureauName)
      );
      if (bureauResults.length === 0) {
        return `Aucun bureau de vote correspondant à "${bureauName}" n'a été trouvé.`;
      }
      for (const bureau of bureauResults) {
        for (let i = 1; i <= 38; i++) {
          const currentCandidate = bureau[`candidat_${i}`];
          if (!currentCandidate) continue;
          if (normalize(currentCandidate).includes(candidateName)) {
            const votes = bureau[`nb_voix_${i}`];
            const percentage = bureau[`pourcentage_${i}`];
            if (votes !== undefined && percentage !== undefined) {
              return `${currentCandidate} a obtenu ${votes} voix (${percentage}%) au bureau de vote ${bureau.nom_lieu} (${bureau.numero_lieu}).`;
            }
          }
        }
      }
      return `Aucun résultat trouvé pour "${candidateName}" au bureau "${bureauName}".`;
    }

    // 2. Résultats d'un candidat sur l'ensemble des bureaux
    function getCandidateResults(results: any[], candidateName: string): string {
      candidateName = normalize(candidateName);
      let totalVotes = 0;
      let totalPercentage = 0;
      let count = 0;
      let candidateFullName = "";
      results.forEach((result) => {
        for (let i = 1; i <= 38; i++) {
          const currentCandidate = result[`candidat_${i}`];
          if (!currentCandidate) continue;
          if (normalize(currentCandidate).includes(candidateName)) {
            const votes = result[`nb_voix_${i}`];
            const percentage = result[`pourcentage_${i}`];
            if (votes !== undefined && percentage !== undefined) {
              totalVotes += votes;
              totalPercentage += percentage;
              count++;
              candidateFullName = currentCandidate;
            }
          }
        }
      });
      if (count === 0) return `Aucun résultat trouvé pour "${candidateName}".`;
      const avgPercentage = (totalPercentage / count).toFixed(2);
      return `${candidateFullName} a obtenu un total de ${totalVotes} voix (${avgPercentage}% en moyenne) sur ${count} bureaux de vote.`;
    }

    // 3. Résultats d'un bureau spécifique
    function getBureauResults(results: any[], bureauName: string): string {
      bureauName = normalize(bureauName);
      const bureauResults = results.filter(
        (result) =>
          result.nom_lieu &&
          (normalize(result.nom_lieu).includes(bureauName) || result.numero_lieu === bureauName)
      );
      if (bureauResults.length === 0) {
        return `Aucun bureau de vote correspondant à "${bureauName}" n'a été trouvé.`;
      }
      const bureau = bureauResults[0];
      const candidateResults: { name: string; votes: number; percentage: number }[] = [];
      for (let i = 1; i <= 38; i++) {
        const candidateName = bureau[`candidat_${i}`];
        const votes = bureau[`nb_voix_${i}`];
        const percentage = bureau[`pourcentage_${i}`];
        if (candidateName && votes !== undefined && percentage !== undefined && votes > 0) {
          candidateResults.push({ name: candidateName, votes, percentage });
        }
      }
      candidateResults.sort((a, b) => b.votes - a.votes);
      let response = `Résultats au bureau de vote ${bureau.nom_lieu} (${bureau.numero_lieu}) :\n\n`;
      candidateResults.forEach((candidate, index) => {
        response += `${index + 1}. ${candidate.name} : ${candidate.votes} voix (${candidate.percentage}%)\n`;
      });
      return response;
    }

    // 4. Liste des candidats (extrait du premier résultat)
    function getCandidatesList(results: any[]): string {
      const firstResult = results[0];
      const candidates: string[] = [];
      for (let i = 1; i <= 38; i++) {
        const candidateName = firstResult[`candidat_${i}`];
        if (candidateName) {
          candidates.push(candidateName);
        }
      }
      return `Liste des candidats aux élections européennes 2024 :\n\n${candidates.join("\n")}`;
    }

    // 5. Taux de participation
    function getParticipationRate(results: any[], bureauName: string | null): string {
      let filtered = results;
      if (bureauName) {
        bureauName = normalize(bureauName);
        filtered = results.filter(
          (result) =>
            result.nom_lieu &&
            (normalize(result.nom_lieu).includes(bureauName) || result.numero_lieu === bureauName)
        );
        if (filtered.length === 0) {
          return `Aucun bureau de vote correspondant à "${bureauName}" n'a été trouvé.`;
        }
      }
      let totalInscrits = 0;
      let totalVotants = 0;
      filtered.forEach((result) => {
        totalInscrits += result.nb_inscrits || 0;
        totalVotants += result.nb_emargements || 0;
      });
      const participationRate = totalInscrits > 0 ? ((totalVotants / totalInscrits) * 100).toFixed(2) : "0";
      if (bureauName) {
        return `Taux de participation au bureau de vote ${filtered[0].nom_lieu} (${filtered[0].numero_lieu}) : ${participationRate}% (${totalVotants} votants sur ${totalInscrits} inscrits)`;
      }
      return `Taux de participation global : ${participationRate}% (${totalVotants} votants sur ${totalInscrits} inscrits)`;
    }

    // 6. Recherche du vainqueur
    function getWinner(results: any[], bureauName: string | null): string {
      let filtered = results;
      if (bureauName) {
        bureauName = normalize(bureauName);
        filtered = results.filter(
          (result) =>
            result.nom_lieu &&
            (normalize(result.nom_lieu).includes(bureauName) || result.numero_lieu === bureauName)
        );
        if (filtered.length === 0) {
          return `Aucun bureau de vote correspondant à "${bureauName}" n'a été trouvé.`;
        }
      }
      const winners = filtered.map((result) => {
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
          percentage: winnerPercentage,
        };
      });
      if (bureauName) {
        const winner = winners[0];
        return `Le vainqueur au bureau de vote ${winner.bureau} (${winner.numero}) est ${winner.winner} avec ${winner.votes} voix (${winner.percentage}%)`;
      }
      // Détermination du vainqueur global en comptant les victoires par candidat
      const winCounts: { [key: string]: number } = {};
      winners.forEach((w) => {
        winCounts[w.winner] = (winCounts[w.winner] || 0) + 1;
      });
      let overallWinner = "";
      let maxWins = 0;
      for (const [candidate, count] of Object.entries(winCounts)) {
        if (count > maxWins) {
          maxWins = count;
          overallWinner = candidate;
        }
      }
      return `Le vainqueur global est ${overallWinner}, arrivé en tête dans ${maxWins} bureaux de vote sur ${filtered.length}.`;
    }

    // 7. Résultats généraux agrégés
    function getGeneralResults(results: any[]): string {
      const candidateTotals: { [key: string]: number } = {};
      let totalExprimes = 0;
      results.forEach((result) => {
        totalExprimes += result.nb_exprimes || 0;
        for (let i = 1; i <= 38; i++) {
          const candidateName = result[`candidat_${i}`];
          const votes = result[`nb_voix_${i}`] || 0;
          if (candidateName) {
            candidateTotals[candidateName] = (candidateTotals[candidateName] || 0) + votes;
          }
        }
      });
      const sortedCandidates = Object.entries(candidateTotals)
        .map(([name, votes]) => ({
          name,
          votes,
          percentage: totalExprimes > 0 ? ((votes / totalExprimes) * 100).toFixed(2) : "0",
        }))
        .sort((a, b) => b.votes - a.votes);
      let response = `Résultats globaux des élections européennes 2024 à Rennes :\n\n`;
      sortedCandidates.slice(0, 10).forEach((candidate, index) => {
        response += `${index + 1}. ${candidate.name} : ${candidate.votes} voix (${candidate.percentage}%)\n`;
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
    // ... autres exemples
  ] as ActionExample[][],
};

export default fetchElectionAction;
