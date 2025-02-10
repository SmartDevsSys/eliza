import { useState, useEffect } from 'react';
import { createAIAgent, supabase, type AIAgent } from '../lib/supabase';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { ImagePlus } from 'lucide-react';
import { useToast } from './ui/use-toast';

interface CreateAIAgentProps {
    onSuccess: () => void;
    initialAgent?: AIAgent;
    isEditing?: boolean;
}

export function CreateAIAgent({ onSuccess, initialAgent, isEditing = false }: CreateAIAgentProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [modelProvider, setModelProvider] = useState(initialAgent?.model_provider || 'mistral');
    const [logo, setLogo] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(initialAgent?.logo || null);
    const { toast } = useToast();

    // Initialize form with existing data if editing
    useEffect(() => {
        if (initialAgent) {
            const form = document.querySelector('form');
            if (form) {
                const nameInput = form.querySelector<HTMLInputElement>('[name="name"]');
                const tagsInput = form.querySelector<HTMLInputElement>('[name="tags"]');
                const bioInput = form.querySelector<HTMLTextAreaElement>('[name="bio"]');
                const loreInput = form.querySelector<HTMLTextAreaElement>('[name="lore"]');
                
                if (nameInput) nameInput.value = initialAgent.name;
                if (tagsInput) tagsInput.value = initialAgent.tags.join(', ');
                if (bioInput) bioInput.value = initialAgent.bio.join('\n');
                if (loreInput) loreInput.value = initialAgent.lore.join('\n');
                
                setModelProvider(initialAgent.model_provider);
                // Set the logo preview from the existing agent
                if (initialAgent.logo) {
                    setLogoPreview(initialAgent.logo);
                }
            }
        } else {
            // Reset form when not editing
            const form = document.querySelector('form');
            if (form) {
                form.reset();
            }
            setModelProvider('mistral');
            setLogo(null);
            setLogoPreview(null);
        }
    }, [initialAgent]);

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            // Check if file type is supported
            if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
                setError('Please upload a valid image file (JPEG, PNG, GIF, or WebP)');
                return;
            }
            setLogo(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const formData = new FormData(e.currentTarget);
        
        try {
            const tagsArray = (formData.get('tags') as string)
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0);

            const bioArray = (formData.get('bio') as string)
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);

            const loreArray = (formData.get('lore') as string)
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);

            // Upload logo if exists
            let logoUrl = null;
            if (logo) {
                const fileExt = logo.name.split('.').pop();
                const fileName = `${formData.get('name')}-${Date.now()}.${fileExt}`;
                
                const { error: logoError } = await supabase.storage
                    .from('agent-logos')
                    .upload(fileName, logo, {
                        contentType: logo.type,
                        cacheControl: '3600'
                    });
                
                if (logoError) {
                    console.error('Logo upload error:', logoError);
                    throw logoError;
                }
                
                const { data: { publicUrl } } = supabase.storage
                    .from('agent-logos')
                    .getPublicUrl(fileName);
                
                logoUrl = publicUrl;
            }

            const agentData = {
                name: formData.get('name') as string,
                // Only update logo if a new one was uploaded
                logo: logoUrl || (isEditing ? initialAgent?.logo : '') || '',
                tags: tagsArray,
                bio: bioArray,
                lore: loreArray,
                model_provider: modelProvider,
                ...(isEditing && initialAgent ? { id: initialAgent.id } : {})
            };

            if (isEditing && initialAgent) {
                // Update existing agent
                const { error: updateError } = await supabase
                    .from('ai_agents')
                    .update({
                        ...agentData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', initialAgent.id);
                
                if (updateError) throw updateError;
                toast({
                    title: "✅ Edit Successful",
                    description: `${agentData.name} has been updated successfully.`
                });
            } else {
                // Create new agent
                await createAIAgent(agentData);
                toast({
                    title: "✅ Creation Successful",
                    description: `${agentData.name} has been created successfully.`
                });
            }
            
            // Reset form and state
            const form = e.target as HTMLFormElement;
            form.reset();
            setModelProvider('mistral');
            setLogo(null);
            setLogoPreview(null);
            setError('');
            onSuccess();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to create AI agent';
            setError(errorMessage);
                toast({
                    title: `❌ ${isEditing ? 'Edit' : 'Creation'} Failed`,
                    description: errorMessage,
                    variant: "destructive"
                });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    {error}
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                    id="name"
                    name="name"
                    required
                    placeholder="Enter agent name"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="logo">Logo</Label>
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

            <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                    id="tags"
                    name="tags"
                    required
                    placeholder="AI, Assistant, Helper"
                />
            </div>

            <div className="space-y-2">
                <Label>Model Provider</Label>
                <Select value={modelProvider} onValueChange={setModelProvider}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="mistral">Mistral</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="bio">Bio (one statement per line)</Label>
                <Textarea
                    id="bio"
                    name="bio"
                    required
                    placeholder="Enter agent bio statements&#10;One per line"
                    className="h-24"
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="lore">Lore (one statement per line)</Label>
                <Textarea
                    id="lore"
                    name="lore"
                    required
                    placeholder="Enter agent lore statements&#10;One per line"
                    className="h-24"
                />
            </div>

            <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? (isEditing ? 'Updating...' : 'Deploying...') : (isEditing ? 'Update Agent' : 'Deploy Agent')}
            </Button>
        </form>
    );
}
