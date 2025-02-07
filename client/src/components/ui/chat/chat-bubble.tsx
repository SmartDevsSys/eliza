import { cn } from "@/lib/utils";
import { TypingIndicator } from "@/components/ui/typing-indicator";

interface ChatBubbleProps {
    variant?: "sent" | "received";
    className?: string;
    children?: React.ReactNode;
}

export function ChatBubble({
    variant = "sent",
    className,
    children,
}: ChatBubbleProps) {
    return (
        <div
            className={cn(
                "flex w-max max-w-[75%] flex-col gap-2 rounded-lg px-4 py-2 text-sm",
                variant === "received"
                    ? "ml-4 bg-muted"
                    : cn(
                          "ml-auto mr-4 bg-primary text-primary-foreground",
                      ),
                className
            )}
        >
            {children}
        </div>
    );
}

interface ChatBubbleMessageProps {
    isLoading?: boolean;
    children?: React.ReactNode;
}

export function ChatBubbleMessage({ isLoading, children }: ChatBubbleMessageProps) {
    if (isLoading) {
        return (
            <div className="flex items-center gap-2 min-h-6">
                <TypingIndicator />
            </div>
        );
    }

    return <div className="min-h-6">{children}</div>;
}

interface ChatBubbleTimestampProps {
    timestamp: string;
}

export function ChatBubbleTimestamp({ timestamp }: ChatBubbleTimestampProps) {
    return (
        <div className="text-xs text-muted-foreground">
            {timestamp}
        </div>
    );
}
