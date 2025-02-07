import { cn } from "@/lib/utils";

export function TypingIndicator({ className }: { className?: string }) {
    return (
        <div className={cn("flex items-center gap-0.5", className)}>
            <div className="size-1.5 rounded-full bg-current animate-[bounce_1.4s_infinite_.2s]" />
            <div className="size-1.5 rounded-full bg-current animate-[bounce_1.4s_infinite_.4s]" />
            <div className="size-1.5 rounded-full bg-current animate-[bounce_1.4s_infinite]" />
        </div>
    );
}

export function AgentStatus({ isTyping, isOnline }: { isTyping?: boolean; isOnline?: boolean }) {
    return (
        <div className="flex items-center gap-2 text-xs">
            {isTyping ? (
                <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">is typing</span>
                    <TypingIndicator className="text-muted-foreground" />
                </div>
            ) : (
                <>
                    <div className={cn(
                        "size-2 rounded-full",
                        isOnline ? "bg-green-500" : "bg-muted-foreground"
                    )} />
                    <span className="text-muted-foreground">
                        {isOnline ? "online" : "offline"}
                    </span>
                </>
            )}
        </div>
    );
}
