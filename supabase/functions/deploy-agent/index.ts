import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { agentId } = await req.json()

    // Get agent data from Supabase
    const { data: agent, error: fetchError } = await supabaseClient
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single()

    if (fetchError) throw fetchError

    // Deploy to Railway using their API
    const deployResponse = await fetch('https://backboard.railway.app/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('RAILWAY_API_TOKEN')}`,
      },
      body: JSON.stringify({
        name: `agent-${agent.name}`,
        template: 'https://github.com/your-org/eliza-agent-template',
        variables: {
          AGENT_CONFIG: JSON.stringify(agent.json_data),
        },
      }),
    })

    if (!deployResponse.ok) {
      throw new Error(`Railway deployment failed: ${await deployResponse.text()}`)
    }

    const deployData = await deployResponse.json()

    // Update agent status in Supabase
    const { error: updateError } = await supabaseClient
      .from('agents')
      .update({ 
        status: 'deploying',
        railway_project_id: deployData.id
      })
      .eq('id', agentId)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
