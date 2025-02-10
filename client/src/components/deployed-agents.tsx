import { type AIAgent } from '../lib/supabase';
import { Button } from './ui/button';
import { User, Pencil, Trash2, Link2, X } from 'lucide-react';
import { useState } from 'react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "./ui/alert-dialog";

interface DeployedAgentsProps {
    agents: AIAgent[];
    onEdit: (agent: AIAgent) => void;
    onDelete: (agentId: string) => void;
}

export function DeployedAgents({ agents, onEdit, onDelete }: DeployedAgentsProps) {
    const [openDialogs, setOpenDialogs] = useState<{ [key: string]: boolean }>({});
    return (
        <div className="bg-card rounded-lg p-6 border">
            <h2 className="font-semibold mb-4">Deployed AI Agents ({agents.length}/3)</h2>
            <div className="space-y-4">
                {agents.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No AI agents deployed yet.</p>
                ) : (
                    agents.map((agent) => (
                        <div
                            key={agent.id}
                            className="border rounded-lg p-4 flex items-start gap-4 bg-background"
                        >
                            <div className="size-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                                {agent.logo ? (
                                    <img
                                        src={agent.logo}
                                        alt={agent.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <User className="size-8 text-muted-foreground" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-medium truncate">{agent.name}</h3>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onEdit(agent)}
                                        >
                                            <Pencil className="size-4" />
                                        </Button>
                                        <AlertDialog 
                                            open={openDialogs[agent.id]} 
                                            onOpenChange={(isOpen: boolean) => {
                                                setOpenDialogs((prev: Record<string, boolean>) => ({
                                                    ...prev,
                                                    [agent.id]: isOpen
                                                }));
                                            }}
                                        >
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => {
                                                        setOpenDialogs((prev: Record<string, boolean>) => ({
                                                            ...prev,
                                                            [agent.id]: true
                                                        }));
                                                    }}
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <div className="flex justify-between items-start">
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Delete AI Agent</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Are you sure you want to delete {agent.name}? This action cannot be undone.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 p-0 rounded-sm"
                                                        onClick={() => {
                                                            setOpenDialogs((prev: Record<string, boolean>) => ({
                                                                ...prev,
                                                                [agent.id]: false
                                                            }));
                                                        }}
                                                    >
                                                        <X className="size-4" />
                                                    </Button>
                                                </div>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel
                                                        onClick={() => {
                                                            setOpenDialogs((prev: Record<string, boolean>) => ({
                                                                ...prev,
                                                                [agent.id]: false
                                                            }));
                                                        }}
                                                    >
                                                        Cancel
                                                    </AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => {
                                                            onDelete(agent.id);
                                                            setOpenDialogs((prev: Record<string, boolean>) => ({
                                                                ...prev,
                                                                [agent.id]: false
                                                            }));
                                                        }}
                                                    >
                                                        Delete
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled
                                        >
                                            <Link2 className="size-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {agent.tags.map((tag, i) => (
                                        <span
                                            key={i}
                                            className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                    {agent.bio[0]}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
