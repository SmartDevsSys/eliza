import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { parse } from 'csv-parse/sync';

// Configuration - Replace with your Supabase credentials
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Check if environment variables are set
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables must be set');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Path to CSV file
const csvFilePath = path.join(process.cwd(), 'data', 'data1.csv');

async function importLegislatorsToSupabase() {
  try {
    // Read and parse the CSV file
    const csvData = fs.readFileSync(csvFilePath, 'utf8');
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true
    });

    console.log(`Found ${records.length} legislators in the CSV file`);

    // Process each record and prepare for insertion
    const legislators = records.map(record => {
      // Generate a UUID for each legislator
      const id = uuidv4();
      
      // Create a name from prenom (first name) and nom (last name)
      const name = `${record.prenom} ${record.nom}`;
      
      // Create a username from the id field
      const username = record.id;
      
      // Use the email from the record
      const email = record.mail || `${record.prenom.toLowerCase()}.${record.nom.toLowerCase()}@example.com`;
      
      // Create an avatar URL (if available)
      const avatarUrl = '';
      
      // Store additional details in the details JSON field
      const details = {
        legislature: record.legislature,
        civ: record.civ,
        villeNaissance: record.villeNaissance,
        naissance: record.naissance,
        age: record.age,
        groupe: record.groupe,
        groupeAbrev: record.groupeAbrev,
        departementNom: record.departementNom,
        departementCode: record.departementCode,
        circo: record.circo,
        datePriseFonction: record.datePriseFonction,
        job: record.job,
        twitter: record.twitter,
        facebook: record.facebook,
        website: record.website,
        nombreMandats: record.nombreMandats,
        experienceDepute: record.experienceDepute,
        scoreParticipation: record.scoreParticipation,
        scoreParticipationSpecialite: record.scoreParticipationSpecialite,
        scoreLoyaute: record.scoreLoyaute,
        scoreMajorite: record.scoreMajorite,
        dateMaj: record.dateMaj
      };
      
      return {
        id,
        name,
        username,
        email,
        avatarUrl,
        details,
        createdAt: new Date().toISOString()
      };
    });

    // Insert data into the accounts table
    const { data, error } = await supabase
      .from('accounts')
      .upsert(legislators);

    if (error) {
      console.error('Error inserting data into Supabase:', error);
      return;
    }

    console.log(`Successfully imported ${legislators.length} legislators to Supabase`);
    
    // Create a room for all legislators
    const roomId = uuidv4();
    const { error: roomError } = await supabase
      .from('rooms')
      .insert({ id: roomId });
    
    if (roomError) {
      console.error('Error creating room:', roomError);
      return;
    }
    
    console.log(`Created room with ID: ${roomId}`);
    
    // Add all legislators as participants in the room
    const participants = legislators.map(legislator => ({
      userId: legislator.id,
      roomId: roomId
    }));
    
    const { error: participantsError } = await supabase
      .from('participants')
      .insert(participants);
    
    if (participantsError) {
      console.error('Error adding participants to room:', participantsError);
      return;
    }
    
    console.log(`Added ${participants.length} legislators as participants to room ${roomId}`);
    
  } catch (error) {
    console.error('Error processing CSV file:', error);
  }
}

// Run the import function
importLegislatorsToSupabase()
  .then(() => console.log('Import process completed'))
  .catch(error => console.error('Import process failed:', error));
