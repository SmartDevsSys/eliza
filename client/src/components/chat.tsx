import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    ChatBubble,
    ChatBubbleMessage,
    ChatBubbleTimestamp,
} from "@/components/ui/chat/chat-bubble";
import ReactMarkdown from 'react-markdown';
import { ChatInput } from "@/components/ui/chat/chat-input";
import { ChatMessageList } from "@/components/ui/chat/chat-message-list";
import { useTransition, animated } from "@react-spring/web";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Content, UUID } from "@elizaos/core";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { cn, moment } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import CopyButton from "./copy-button";
import ChatTtsButton from "./ui/chat/chat-tts-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import type { IAttachment } from "@/types";
import { AudioRecorder } from "./audio-recorder";
import { Badge } from "./ui/badge";
import { useAutoScroll } from "./ui/chat/hooks/useAutoScroll";
import { useTypingStatus } from "@/contexts/typing-status";
import { useAuth } from "@/contexts/auth-context";

type ExtraContentFields = {
    user: string;
    createdAt: number;
    isLoading?: boolean;
    isTyping?: boolean;
};

type Message = {
    id: string;
    text: string;
    user: string;
    createdAt: string;
    attachments?: {
        url: string;
        contentType: string;
        title: string;
    }[];
};

type ContentWithUser = Content & ExtraContentFields;

type QueryMessage = Message & {
    source?: string;
    action?: string;
};

export default function Page({ agentId }: { agentId: UUID }) {
    const { toast } = useToast();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [input, setInput] = useState("");
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const formRef = useRef<HTMLFormElement>(null);

    const queryClient = useQueryClient();
    const { user } = useAuth();

    // Load agent information
    const agentQuery = useQuery({
        enabled: !!agentId,
        queryKey: ["agent", agentId] as const,
        queryFn: () => apiClient.getAgent(agentId),
        staleTime: Infinity,
        retry: false,
        gcTime: Infinity,
    });

    // Load existing messages
    const messagesQuery = useQuery({
        enabled: !!user,
        queryKey: ["messages", agentId] as const,
        queryFn: () => apiClient.loadMessages(agentId),
        staleTime: Infinity,
        retry: false,
        gcTime: Infinity,
    });

    const { data: existingMessages, isLoading: isLoadingMessages } = messagesQuery;

    // Handle query errors
    useEffect(() => {
        if (messagesQuery.error) {
            toast({
                variant: "destructive",
                title: "Error loading messages",
                description: messagesQuery.error.message,
            });
        }
    }, [messagesQuery.error]);

    // Initialize messages from Supabase data
    useEffect(() => {
        if (existingMessages) {
            queryClient.setQueryData(
                ["messages", agentId],
                existingMessages.map((msg: QueryMessage) => ({
                    ...msg,
                    createdAt: new Date(msg.createdAt).getTime(),
                }))
            );
        }
    }, [existingMessages, agentId]);

    const getMessageVariant = (role: string) =>
        role !== "user" ? "received" : "sent";

    const { scrollRef, isAtBottom, scrollToBottom, disableAutoScroll } = useAutoScroll({
        smooth: true,
    });
   
    useEffect(() => {
        // Ensure messages are properly positioned when switching agents
        const messages = queryClient.getQueryData(["messages", agentId]);
        if (messages) {
            // Use double requestAnimationFrame to ensure DOM is fully updated
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    scrollToBottom();
                });
            });
        }
    }, [queryClient.getQueryData(["messages", agentId]), agentId]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (e.nativeEvent.isComposing) return;
            handleSendMessage(e as unknown as React.FormEvent<HTMLFormElement>);
        }
    };

    const { setAgentTyping } = useTypingStatus();

    useEffect(() => {
        return () => {
            // Cleanup typing status when leaving chat
            setAgentTyping(agentId, false);
        };
    }, [agentId, setAgentTyping]);

    const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!input) return;

        const attachments: IAttachment[] | undefined = selectedFile
            ? [
                  {
                      url: URL.createObjectURL(selectedFile),
                      contentType: selectedFile.type,
                      title: selectedFile.name,
                  },
              ]
            : undefined;

        const messageText = input;
        const messageFile = selectedFile;

        // Clear input immediately
        setSelectedFile(null);
        setInput("");
        formRef.current?.reset();

        const newMessages = [
            {
                text: messageText,
                user: "user",
                createdAt: Date.now(),
                attachments,
            },
            {
                text: "",
                user: "system",
                isLoading: true,
                isTyping: true,
                createdAt: Date.now(),
            },
        ];

        // Only update local state for optimistic UI
        queryClient.setQueryData(
            ["messages", agentId],
            (old: ContentWithUser[] = []) => [...old, ...newMessages.map(msg => ({
                ...msg,
                createdAt: Date.now(),
            }))]
        );

        // Update typing status and send message
        setAgentTyping(agentId, true);
        sendMessageMutation.mutate({
            message: messageText,
            selectedFile: messageFile || null,
        });
    };

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const sendMessageMutation = useMutation({
        mutationKey: ["send_message", agentId],
        mutationFn: ({
            message,
            selectedFile,
        }: {
            message: string;
            selectedFile?: File | null;
        }) => apiClient.sendMessage(agentId, message, selectedFile),
        onSuccess: (newMessages: ContentWithUser[]) => {
            setAgentTyping(agentId, false);
            queryClient.setQueryData(
                ["messages", agentId],
                (old: ContentWithUser[] = []) => [
                    ...old.filter((msg) => !msg.isLoading && !msg.isTyping),
                    ...newMessages.map((msg) => ({
                        ...msg,
                        createdAt: Date.now(),
                    })),
                ]
            );
        },
        onError: (e) => {
            toast({
                variant: "destructive",
                title: "Unable to send message",
                description: e.message,
            });
        },
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file?.type.startsWith("image/")) {
            setSelectedFile(file);
        }
    };

    const messages =
        queryClient.getQueryData<ContentWithUser[]>(["messages", agentId]) ||
        [];

    const transition = useTransition(agentId, {
        from: { opacity: 0 },
        enter: { opacity: 1 },
        leave: { opacity: 0 },
        config: { duration: 150 },
        immediate: true
    });

    const AnimatedMessages = animated(
        ({ children, style }: { children: React.ReactNode; style: any }) => (
            <div style={style} className="w-full">
                {children}
            </div>
        )
    );

    if (!user) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-2">
                    <p className="text-sm text-muted-foreground">Please sign in to view messages</p>
                </div>
            </div>
        );
    }

    if (isLoadingMessages) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading messages...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col w-full h-full">
            <div className="border-b bg-background">
                <div className="flex items-center justify-between py-2.5 px-4">
                    <div className="flex items-center gap-2">
                        <Avatar className="size-10 border rounded-full select-none">
                            <AvatarImage src={`/agents/${agentId}/icon.png`} />
                            <AvatarFallback>
                                <img src="/elizaos-icon.png" alt="ElizaOS" className="w-full h-full object-cover" />
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <h3 className="font-medium text-base">{agentQuery.data?.character.name || "ElizaOS Assistant"}</h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const jsonStr = JSON.stringify(messages, null, 2);
                                const blob = new Blob([jsonStr], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `chat-export-${new Date().toISOString()}.json`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                            }}
                        >
                            Export
                        </Button>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                    Clear Chat
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Clear Chat History</DialogTitle>
                                    <DialogDescription>
                                        Are you sure you want to clear all messages? This action cannot be undone.
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">
                                            Cancel
                                        </Button>
                                    </DialogClose>
                                    <DialogClose asChild>
                                        <Button 
                                            variant="destructive"
                                            onClick={() => {
                                                queryClient.setQueryData(["messages", agentId], []);
                                            }}
                                        >
                                            Clear
                                        </Button>
                                    </DialogClose>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto px-4 py-4 relative">
                <ChatMessageList 
                    scrollRef={scrollRef}
                    isAtBottom={isAtBottom}
                    scrollToBottom={scrollToBottom}
                    disableAutoScroll={disableAutoScroll}
                >
                    {transition((style) => (
                        <AnimatedMessages key={agentId} style={style}>
                            {messages.map((message: ContentWithUser) => {
                                const variant = getMessageVariant(message?.user);
                                return (
                                    <div 
                                        key={`${message.createdAt}-${message.user}-${message.text}`}
                                        className="flex flex-col py-2"
                                    >
                                        <ChatBubble
                                            variant={variant}
                                            className="flex flex-row items-start gap-2"
                                        >
                                            {message?.user !== "user" ? (
                                                <Avatar className="size-8 mt-1 border rounded-full select-none">
                                                    <AvatarImage src={`/agents/${agentId}/icon.png`} />
                                                    <AvatarFallback>
                                                        <img src="/elizaos-icon.png" alt="ElizaOS" className="w-full h-full object-cover" />
                                                    </AvatarFallback>
                                                </Avatar>
                                            ) : null}
                                            <div className="flex flex-col">
                                                <ChatBubbleMessage
                                                    isLoading={message?.isLoading || message?.isTyping}
                                                >
                                                    {message?.user !== "user" ? (
                                                        <div className="prose max-w-[600px]">
                                                            <ReactMarkdown
                                                                components={{
                                                                    a: ({ node, ...props }) => (
                                                                        <a
                                                                            {...props}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-primary hover:underline"
                                                                        />
                                                                    ),
                                                                    p: ({ node, ...props }) => (
                                                                        <p {...props} className="whitespace-pre-wrap my-0" />
                                                                    ),
                                                                    ul: ({ node, ...props }) => (
                                                                        <ul {...props} className="my-1" />
                                                                    ),
                                                                    li: ({ node, ...props }) => (
                                                                        <li {...props} className="my-0" />
                                                                    ),
                                                                    code: ({ inline, className, children, ...props }: any) => {
                                                                        return inline ? 
                                                                            <code {...props} className="bg-muted px-1.5 py-0.5 rounded text-sm">
                                                                                {children}
                                                                            </code> :
                                                                            <code {...props} className="block bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                                                                                {children}
                                                                            </code>
                                                                    }
                                                                }}
                                                            >
                                                                {message?.text?.replace(/\\n/g, '\n').replace(/\[/g, '\\[').replace(/\]/g, '\\]')}
                                                            </ReactMarkdown>
                                                        </div>
                                                    ) : (
                                                        <span className="whitespace-pre-wrap block max-w-[600px]">{message?.text}</span>
                                                    )}
                                                    <div>
                                                        {message?.attachments?.map(
                                                            (attachment: IAttachment) => (
                                                                <div
                                                                    className="flex flex-col gap-1 mt-2"
                                                                    key={`${attachment.url}-${attachment.title}`}
                                                                >
                                                                    <img
                                                                        alt="attachment"
                                                                        src={attachment.url}
                                                                        width="100%"
                                                                        height="100%"
                                                                        className="max-w-[600px] rounded-md"
                                                                    />
                                                                    <div className="flex items-center justify-between gap-4">
                                                                        <span />
                                                                        <span />
                                                                    </div>
                                                                </div>
                                                            )
                                                        )}
                                                    </div>
                                                </ChatBubbleMessage>
                                                <div className="flex items-center gap-4 justify-between w-full mt-1">
                                                    {message?.text &&
                                                    !message?.isLoading &&
                                                    !message?.isTyping ? (
                                                        <div className="flex items-center gap-1">
                                                            <CopyButton text={message?.text} />
                                                            <ChatTtsButton
                                                                agentId={agentId}
                                                                text={message?.text}
                                                            />
                                                        </div>
                                                    ) : null}
                                                    <div
                                                        className={cn([
                                                            message?.isLoading || message?.isTyping
                                                                ? "mt-2"
                                                                : "",
                                                            "flex items-center justify-between gap-4 select-none",
                                                        ])}
                                                    >
                                                        {message?.source ? (
                                                            <Badge variant="outline">
                                                                {message.source}
                                                            </Badge>
                                                        ) : null}
                                                        {message?.action ? (
                                                            <Badge variant="outline">
                                                                {message.action}
                                                            </Badge>
                                                        ) : null}
                                                        {message?.createdAt ? (
                                                            <ChatBubbleTimestamp
                                                                timestamp={moment(message?.createdAt).format("LT")}
                                                            />
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                        </ChatBubble>
                                    </div>
                                );
                            })}
                        </AnimatedMessages>
                    ))}
                </ChatMessageList>
            </div>
            <div className="border-t bg-background">
                <form
                    ref={formRef}
                    onSubmit={handleSendMessage}
                    className="px-4 py-3"
                >
                    {selectedFile ? (
                        <div className="mb-3">
                            <div className="relative inline-block">
                                <Button
                                    onClick={() => setSelectedFile(null)}
                                    className="absolute -right-2 -top-2 size-[22px] ring-2 ring-background"
                                    variant="outline"
                                    size="icon"
                                >
                                    <X className="size-3" />
                                </Button>
                                <img
                                    alt="Selected file"
                                    src={URL.createObjectURL(selectedFile)}
                                    height="100%"
                                    width="100%"
                                    className="aspect-square object-contain w-16 rounded border"
                                />
                            </div>
                        </div>
                    ) : null}
                    <div className="flex items-center gap-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="rounded-full"
                                        onClick={() => {
                                            if (fileInputRef.current) {
                                                fileInputRef.current.click();
                                            }
                                        }}
                                    >
                                        <Paperclip className="size-5" />
                                        <span className="sr-only">
                                            Attach file
                                        </span>
                                    </Button>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p>Attach file</p>
                            </TooltipContent>
                        </Tooltip>

                        <div className="flex-1">
                            <ChatInput
                                ref={inputRef}
                                onKeyDown={handleKeyDown}
                                value={input}
                                onChange={({ target }) => setInput(target.value)}
                                placeholder="Type a message"
                                className="min-h-10 resize-none rounded-full bg-muted px-4 py-2 shadow-none focus-visible:ring-0"
                            />
                        </div>

                        {input ? (
                            <Button
                                disabled={sendMessageMutation?.isPending}
                                type="submit"
                                size="icon"
                                className="rounded-full"
                            >
                                <Send className="size-5" />
                            </Button>
                        ) : (
                            <AudioRecorder
                                agentId={agentId}
                                onChange={(newInput: string) => setInput(newInput)}
                                className="rounded-full"
                            />
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
