import { useAuth } from "@/contexts/auth-context";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { CreateAIAgent } from "@/components/create-ai-agent";
import { DeployedAgents } from "@/components/deployed-agents";
import { useState, useEffect } from "react";
import { type AIAgent, deleteAIAgent, getUserAIAgents } from "@/lib/supabase";

export default function CreatePage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [editingAgent, setEditingAgent] = useState<AIAgent | undefined>();
    const [agents, setAgents] = useState<AIAgent[]>([]);

    // Function to fetch agents
    const fetchAgents = async () => {
        if (!user) return;
        try {
            const data = await getUserAIAgents();
            setAgents(data);
        } catch (error) {
            console.error('Error fetching AI agents:', error);
        }
    };

    // Initial fetch when component mounts
    useEffect(() => {
        fetchAgents();
    }, [user]);

    // Set up polling every 5 seconds
    useEffect(() => {
        if (!user) return;
        
        const interval = setInterval(fetchAgents, 5000);
        return () => clearInterval(interval);
    }, [user]);

    // Trigger a fetch after a short delay when changes occur
    const refreshAfterChange = () => {
        setTimeout(fetchAgents, 1000);
    };
    
    const handleEdit = (agent: AIAgent) => {
        setEditingAgent(agent);
        toast({
            title: "✏️ Edit Mode",
            description: `Now editing ${agent.name}. Make your changes below.`
        });
        // Scroll to form
        document.querySelector('.create-form')?.scrollIntoView({ behavior: 'smooth' });
    };
    
    const handleDelete = async (agentId: string) => {
        try {
            await deleteAIAgent(agentId);
            // If we're editing this agent, clear the form
            if (editingAgent?.id === agentId) {
                setEditingAgent(undefined);
            }
            const deletedAgent = agents.find(agent => agent.id === agentId);
            toast({
                title: "✅ Deleted Successfully !",
                description: `${deletedAgent?.name || 'Agent'} has been deleted from your agents.`
            });
            refreshAfterChange();
        } catch (error) {
            console.error('Error deleting agent:', error);
            toast({
                title: "❌ Deleted Failed",
                description: "Unable to delete the agent. Please try again.",
                variant: "destructive"
            });
        }
    };

    if (!user) {
        return (
            <div className="container mx-auto p-6">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
                    <p>Please sign in to create an agent.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-4xl font-bold mb-4">
                {editingAgent ? `Editing ${editingAgent.name}` : 'Create an Agent'}
            </h1>
            <p className="text-gray-500 mb-8">
                {editingAgent 
                    ? 'Edit your AI agent\'s information below.'
                    : 'Create your AI agent by filling out the essential information below.'}
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="create-form">
                    <Card className="p-6 bg-card">
                        <CreateAIAgent 
                            onSuccess={() => {
                                setEditingAgent(undefined);
                                refreshAfterChange();
                            }}
                            initialAgent={editingAgent}
                            isEditing={!!editingAgent}
                        />
                    </Card>
                </div>
                
                <div>
                    <DeployedAgents
                        agents={agents}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />
                </div>
            </div>
        </div>
    );
}
