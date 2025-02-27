import {
  Action,
  ActionExample,
  Content,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  ModelClass,
  State,
  generateText,
  getEmbeddingZeroVector,
} from "@elizaos/core";

// Fonction de normalisation : enlève les accents, passe en minuscules et supprime les espaces superflus
function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// Fonction pour extraire le JSON de la réponse, au cas où le modèle renvoie du texte additionnel
function extractJSON(text: string): string {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.substring(firstBrace, lastBrace + 1);
  }
  return text;
}

const fetchElectionAction: Action = {
  name: "FETCH_ELECTION",
  similes: ["ELECTION_DATA", "GET_ELECTION_RESULTS", "ELECTION_RESULTS", "VOTING_RESULTS"],
  validate: async (_runtime: IAgentRuntime, _message: Memory) => true,
  description:
    "Récupère les résultats électoraux depuis l'API open data de Rennes Metropole. Permet de filtrer par commune, bureau de vote, candidat et de répondre à des requêtes spécifiques.",
  handler: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
    _options: { [key: string]: unknown },
    _callback: HandlerCallback,
  ): Promise<boolean> => {
    // Fonction pour récupérer les données électorales depuis l'API
    async function fetchElectionData(limit: number = 100): Promise<any[] | null> {
      const url = `https://data.rennesmetropole.fr/api/explore/v2.1/catalog/datasets/resultats_rennesmetropole_e24_1/records?limit=${limit}`;
      console.log(`Fetching election data from: ${url}`);
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch election data: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.results || data.results.length === 0) return null;
        console.log(`Successfully fetched ${data.results.length} election results`);
        return data.results;
      } catch (error) {
        console.error("Failed to fetch election data:", error);
        return null;
      }
    }

    // Extraction des paramètres depuis le message utilisateur via generateText
    const extractionPrompt = `
Analyse le message suivant concernant les résultats électoraux : "${_message.content.text}"
Extrais STRICTEMENT les informations suivantes en renvoyant uniquement un JSON sans texte additionnel :
- "commune" : le nom de la commune (ex: "Rennes")
- "bureau" : le nom ou numéro du bureau de vote (ex: "Groupe Scolaire Jules Isaac", "bureau 115")
- "candidate" : le nom du candidat (ex: "Maréchal Marion")
- "specificRequest" : une requête spécifique (ex: "taux de participation", "gagnant", "liste des candidats")
Exemple de réponse EXACTE :
{"commune": "rennes", "bureau": "groupe scolaire jules isaac", "candidate": null, "specificRequest": "taux de participation"}
`;
    const extractedParamsTextRaw = await generateText({
      runtime: _runtime,
      context: extractionPrompt,
      modelClass: ModelClass.SMALL,
    });
    console.log("Raw extracted parameters:", extractedParamsTextRaw);

    // Extraire uniquement le JSON
    const extractedParamsText = extractJSON(extractedParamsTextRaw);
    console.log("Extracted JSON:", extractedParamsText);

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

    // Récupération des données depuis l'API
    const results = await fetchElectionData();
    if (!results) {
      return _callback({
        text: "Désolé, je n'ai pas pu récupérer les données électorales.",
        action: "FETCH_ELECTION_RESPONSE",
      });
    }

    // Filtrage initial par commune si précisé
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

    // Traitement des requêtes spécifiques
    let responseText = "";
    if (params.specificRequest && params.bureau) {
      switch (params.specificRequest) {
        case "taux de participation":
          responseText = getParticipationRate(filteredResults, params.bureau);
          break;
        default:
          responseText = `Désolé, la requête "${params.specificRequest}" n'est pas encore prise en charge.`;
      }
    } else if (params.candidate && params.bureau) {
      responseText = getCandidateInBureau(filteredResults, params.candidate, params.bureau);
    } else {
      responseText = "Désolé, cette fonctionnalité n'est implémentée que pour le filtrage candidat + bureau ou des requêtes spécifiques comme le taux de participation.";
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

    // --- Fonction pour le taux de participation ---
    function getParticipationRate(results: any[], bureauQuery: string): string {
      const bureauResults = results.find((result) =>
        normalize(result.nom_lieu).includes(normalize(bureauQuery))
      );
      if (!bureauResults) {
        return `Aucun bureau de vote correspondant à "${bureauQuery}" n'a été trouvé.`;
      }
      const participation = bureauResults.tx_participation;
      return `Le taux de participation au bureau de vote "${bureauQuery}" est de ${participation}%.`;
    }
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "Quel est le taux de participation dans le groupe scolaire Carle Bahoi ?",
        },
      },
      {
        user: "{{user2}}",
        content: { text: "", action: "FETCH_ELECTION" },
      },
    ],
      [
      {
        user: "{{user1}}",
        content: {
          text: "Donne-moi le résultat de Maréchal Marion au bureau de vote Collège Echange aux élections européennes"
        }
      },
      {
        user: "{{user2}}",
        content: { text: "", action: "FETCH_ELECTION" }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Qui a gagné au bureau 115 à Rennes ?"
        }
      },
      {
        user: "{{user2}}",
        content: { text: "", action: "FETCH_ELECTION" }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Liste des candidats au Groupe Scolaire Jules Isaac"
        }
      },
      {
        user: "{{user2}}",
        content: { text: "", action: "FETCH_ELECTION" }
      }
    ]
  ] as ActionExample[][],
};

export default fetchElectionAction;
