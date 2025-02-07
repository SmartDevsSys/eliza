import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImagePlus } from "lucide-react";

export default function CreatePage() {
    const [formData, setFormData] = useState({
        name: "",
        tags: [] as string[],
        modelProvider: "anthropic",
        plugins: [],
        clients: [],
        settings: {
            secrets: {},
            voice: {}
        },
        system: "",
        bio: [""],
        lore: [""],
        knowledge: [""],
        messageExamples: [
            {
                user: { content: { text: "" } },
                assistant: { content: { text: "" } }
            }
        ],
        postExamples: [""],
        adjectives: [""],
        topics: [""],
        style: {
            all: [""],
            chat: [""],
            post: [""]
        }
    });

    const [logo, setLogo] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);

    const modelProviders = [
        { value: "anthropic", label: "Anthropic" },
        { value: "deepseek", label: "DeepSeek" },
        { value: "openai", label: "OpenAI" }
    ];

    const handleArrayInput = (field: string, value: string) => {
        const lines = value.split('\n');
        setFormData(prev => ({
            ...prev,
            [field]: lines
        }));
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setLogo(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const { user } = useAuth();
    const [userSettings, setUserSettings] = useState<{ max_agents: number; agents_created: number } | null>(null);
    const [canCreateAgent, setCanCreateAgent] = useState(false);

    useEffect(() => {
        const fetchUserSettings = async () => {
            if (!user) return;

            const { data, error } = await supabase
                .from('user_settings')
                .select('max_agents, agents_created')
                .eq('user_id', user.id)
                .single();

            if (error) {
                console.error('Error fetching user settings:', error);
                return;
            }

            setUserSettings(data);
            setCanCreateAgent(data.agents_created < data.max_agents);
        };

        fetchUserSettings();
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            // Upload logo if exists
            let logoUrl = null;
            if (logo) {
                // Verify bucket exists
                const { data: buckets } = await supabase.storage.listBuckets();
                const bucketExists = buckets?.some(b => b.name === 'agent-logos');
                
                if (!bucketExists) {
                    throw new Error('Storage not configured. Please contact administrator.');
                }

                const { data: logoData, error: logoError } = await supabase.storage
                    .from('agent-logos')
                    .upload(`${formData.name}-${Date.now()}`, logo);
                
                if (logoError) throw logoError;
                
                const { data: { publicUrl } } = supabase.storage
                    .from('agent-logos')
                    .getPublicUrl(logoData.path);
                    
                logoUrl = publicUrl;
            }

            if (!user) {
                throw new Error('You must be logged in to create an agent');
            }

            if (!canCreateAgent) {
                throw new Error(`You have reached your limit of ${userSettings?.max_agents} agents`);
            }

            // Create agent in Supabase
            const { data: agent, error: agentError } = await supabase
                .from('agents')
                .insert([{
                    name: formData.name,
                    logo_url: logoUrl,
                    json_data: {
                        ...formData,
                        logo: logoUrl
                    },
                    status: 'pending',
                    user_id: user.id
                }])
                .select()
                .single();

            if (agentError) throw agentError;

            // Trigger Railway deployment
            const { error: deployError } = await supabase.functions.invoke('deploy-agent', {
                body: { agentId: agent.id }
            });

            if (deployError) throw deployError;

            // Redirect to status page
            navigate(`/agents/${agent.id}/status`);
        } catch (error) {
            console.error('Error creating agent:', error);
            alert('Failed to create agent. Please try again.');
        } finally {
            setIsLoading(false);
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

    if (!canCreateAgent && userSettings) {
        return (
            <div className="container mx-auto p-6">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">Agent Limit Reached</h1>
                    <p>You have reached your limit of {userSettings.max_agents} agents.</p>
                    <p className="mt-2">Current agents: {userSettings.agents_created}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-4xl font-bold mb-4">Create an Agent</h1>
            <p className="text-gray-500 mb-8">
                Create your AI agent by filling out the form below.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
                <Card className="p-6 bg-card">
                    <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="logo" className="block mb-2">Logo</Label>
                            <div className="flex items-center space-x-4">
                                <div className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center relative overflow-hidden">
                                    {logoPreview ? (
                                        <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <ImagePlus className="w-8 h-8 text-gray-400" />
                                    )}
                                    <input
                                        type="file"
                                        id="logo"
                                        accept="image/*"
                                        onChange={handleLogoChange}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm text-gray-500">
                                        Upload your agent's logo. Click or drag and drop an image file.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="name">Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Enter agent name"
                            />
                        </div>
                        <div>
                            <Label htmlFor="tags">Tags (max 3)</Label>
                            <div className="space-y-2">
                                <div className="flex flex-wrap gap-2">
                                    {formData.tags.map((tag, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-1 px-3 py-1 bg-primary/10 rounded-full"
                                        >
                                            <span>{tag}</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        tags: prev.tags.filter((_, i) => i !== index)
                                                    }));
                                                }}
                                                className="text-sm hover:text-destructive"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {formData.tags.length < 3 && (
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Enter a tag and press Enter"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const input = e.currentTarget;
                                                    const value = input.value.trim();
                                                    if (value && formData.tags.length < 3) {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            tags: [...prev.tags, value]
                                                        }));
                                                        input.value = '';
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="modelProvider">Model Provider</Label>
                            <select
                                id="modelProvider"
                                value={formData.modelProvider}
                                onChange={(e) => setFormData(prev => ({ ...prev, modelProvider: e.target.value }))}
                                className="w-full px-3 py-2 bg-background border border-input rounded-md"
                            >
                                {modelProviders.map(provider => (
                                    <option key={provider.value} value={provider.value}>
                                        {provider.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="opacity-50">
                            <Label>Plugins</Label>
                            <Input
                                disabled
                                value="No plugins available"
                                className="bg-muted"
                            />
                        </div>
                        <div className="opacity-50">
                            <Label>Clients</Label>
                            <Input
                                disabled
                                value="No clients available"
                                className="bg-muted"
                            />
                        </div>
                        <div>
                            <Label htmlFor="system">System Prompt</Label>
                            <Textarea
                                id="system"
                                value={formData.system}
                                onChange={(e) => setFormData(prev => ({ ...prev, system: e.target.value }))}
                                placeholder="Enter system prompt"
                                rows={4}
                                className="font-mono"
                            />
                        </div>
                    </div>
                </Card>

                <Card className="p-6 bg-card">
                    <h2 className="text-xl font-semibold mb-4">Character Details</h2>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="bio">Bio (one per line)</Label>
                            <Textarea
                                id="bio"
                                value={formData.bio.join('\n')}
                                onChange={(e) => handleArrayInput('bio', e.target.value)}
                                placeholder="Enter bio points"
                                rows={8}
                                className="font-mono whitespace-pre-wrap"
                            />
                        </div>
                        <div>
                            <Label htmlFor="lore">Lore (one per line)</Label>
                            <Textarea
                                id="lore"
                                value={formData.lore.join('\n')}
                                onChange={(e) => handleArrayInput('lore', e.target.value)}
                                placeholder="Enter lore points"
                                rows={8}
                                className="font-mono whitespace-pre-wrap"
                            />
                        </div>
                        <div>
                            <Label htmlFor="knowledge">Knowledge (one per line)</Label>
                            <Textarea
                                id="knowledge"
                                value={formData.knowledge.join('\n')}
                                onChange={(e) => handleArrayInput('knowledge', e.target.value)}
                                placeholder="Enter knowledge points"
                                rows={8}
                                className="font-mono whitespace-pre-wrap"
                            />
                        </div>
                    </div>
                </Card>

                <Card className="p-6 bg-card">
                    <h2 className="text-xl font-semibold mb-4">Message Examples</h2>
                    <div className="space-y-4">
                        {formData.messageExamples.map((example, index) => (
                            <div key={index} className="space-y-2 p-4 border rounded-lg">
                                <div>
                                    <Label>User Message</Label>
                                    <Textarea
                                        value={example.user.content.text}
                                        onChange={(e) => {
                                            const newExamples = [...formData.messageExamples];
                                            newExamples[index].user.content.text = e.target.value;
                                            setFormData(prev => ({ ...prev, messageExamples: newExamples }));
                                        }}
                                        placeholder="Enter user message"
                                        rows={2}
                                        className="font-mono"
                                    />
                                </div>
                                <div>
                                    <Label>Assistant Response</Label>
                                    <Textarea
                                        value={example.assistant.content.text}
                                        onChange={(e) => {
                                            const newExamples = [...formData.messageExamples];
                                            newExamples[index].assistant.content.text = e.target.value;
                                            setFormData(prev => ({ ...prev, messageExamples: newExamples }));
                                        }}
                                        placeholder="Enter assistant response"
                                        rows={4}
                                        className="font-mono whitespace-pre-wrap"
                                    />
                                </div>
                            </div>
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setFormData(prev => ({
                                ...prev,
                                messageExamples: [
                                    ...prev.messageExamples,
                                    { user: { content: { text: "" } }, assistant: { content: { text: "" } } }
                                ]
                            }))}
                            className="w-full"
                        >
                            Add Message Example
                        </Button>
                    </div>
                </Card>

                <Card className="p-6 bg-card">
                    <h2 className="text-xl font-semibold mb-4">Post Examples</h2>
                    <div className="space-y-4">
                        <Textarea
                            value={formData.postExamples.join('\n')}
                            onChange={(e) => handleArrayInput('postExamples', e.target.value)}
                            placeholder="Enter post examples (one per line)"
                            rows={8}
                            className="font-mono whitespace-pre"
                        />
                    </div>
                </Card>

                <Card className="p-6 bg-card">
                    <h2 className="text-xl font-semibold mb-4">Communication Style</h2>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="adjectives">Adjectives (one per line)</Label>
                            <Textarea
                                id="adjectives"
                                value={formData.adjectives.join('\n')}
                                onChange={(e) => handleArrayInput('adjectives', e.target.value)}
                                placeholder="Enter adjectives"
                                rows={6}
                                className="font-mono whitespace-pre-wrap"
                            />
                        </div>
                        <div>
                            <Label htmlFor="topics">Topics (one per line)</Label>
                            <Textarea
                                id="topics"
                                value={formData.topics.join('\n')}
                                onChange={(e) => handleArrayInput('topics', e.target.value)}
                                placeholder="Enter topics"
                                rows={6}
                                className="font-mono whitespace-pre-wrap"
                            />
                        </div>
                    </div>
                </Card>

                <Card className="p-6 bg-card">
                    <h2 className="text-xl font-semibold mb-4">Style Configuration</h2>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="style-all">General Style (one per line)</Label>
                            <Textarea
                                id="style-all"
                                value={formData.style.all.join('\n')}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    style: {
                                        ...prev.style,
                                        all: e.target.value.split('\n').filter(item => item.trim() !== '')
                                    }
                                }))}
                                placeholder="Enter general style points"
                                rows={6}
                                className="font-mono whitespace-pre-wrap"
                            />
                        </div>
                        <div>
                            <Label htmlFor="style-chat">Chat Style (one per line)</Label>
                            <Textarea
                                id="style-chat"
                                value={formData.style.chat.join('\n')}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    style: {
                                        ...prev.style,
                                        chat: e.target.value.split('\n').filter(item => item.trim() !== '')
                                    }
                                }))}
                                placeholder="Enter chat style points"
                                rows={6}
                                className="font-mono whitespace-pre-wrap"
                            />
                        </div>
                        <div>
                            <Label htmlFor="style-post">Post Style (one per line)</Label>
                            <Textarea
                                id="style-post"
                                value={formData.style.post.join('\n')}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    style: {
                                        ...prev.style,
                                        post: e.target.value.split('\n').filter(item => item.trim() !== '')
                                    }
                                }))}
                                placeholder="Enter post style points"
                                rows={6}
                                className="font-mono whitespace-pre-wrap"
                            />
                        </div>
                    </div>
                </Card>

                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating Agent...
                        </>
                    ) : (
                        'Create Agent'
                    )}
                </Button>
            </form>
        </div>
    );
}
