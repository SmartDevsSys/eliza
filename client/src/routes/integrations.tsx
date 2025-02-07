import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Github, Slack, Twitter, MessagesSquare, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";

const integrations = [
    {
        name: "Telegram",
        description: "Connect your AI agent to Telegram and chat with users directly through their favorite messaging app.",
        icon: MessageCircle,
        color: "text-blue-400",
        bgColor: "bg-blue-400/10",
        borderColor: "border-blue-400/20",
        link: "#"
    },
    {
        name: "Discord",
        description: "Integrate your AI agent into Discord servers to assist communities and automate tasks.",
        icon: Hash,
        color: "text-indigo-400",
        bgColor: "bg-indigo-400/10",
        borderColor: "border-indigo-400/20",
        link: "#"
    },
    {
        name: "WhatsApp",
        description: "Enable your AI agent to communicate through WhatsApp, reaching users on the world's most popular messaging platform.",
        icon: MessagesSquare,
        color: "text-green-400",
        bgColor: "bg-green-400/10",
        borderColor: "border-green-400/20",
        link: "#"
    },
    {
        name: "GitHub",
        description: "Let your AI agent assist with code reviews, issue management, and repository maintenance on GitHub.",
        icon: Github,
        color: "text-gray-400",
        bgColor: "bg-gray-400/10",
        borderColor: "border-gray-400/20",
        link: "#"
    },
    {
        name: "Slack",
        description: "Integrate your AI agent into Slack workspaces to enhance team productivity and automate workflows.",
        icon: Slack,
        color: "text-purple-400",
        bgColor: "bg-purple-400/10",
        borderColor: "border-purple-400/20",
        link: "#"
    },
    {
        name: "Twitter/X",
        description: "Deploy your AI agent on Twitter/X to engage with users, monitor trends, and automate social media interactions.",
        icon: Twitter,
        color: "text-sky-400",
        bgColor: "bg-sky-400/10",
        borderColor: "border-sky-400/20",
        link: "#"
    }
];

export default function IntegrationsPage() {
    return (
        <div className="container mx-auto p-6">
            <div className="max-w-3xl mx-auto text-center mb-12">
                <h1 className="text-3xl font-bold mb-4">Platform Integrations</h1>
                <p className="text-lg text-muted-foreground">
                    Connect your AI agent with popular platforms and expand its reach. Our integrations 
                    enable seamless communication across multiple channels.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {integrations.map((integration) => {
                    const Icon = integration.icon;
                    return (
                        <Card 
                            key={integration.name}
                            className={`relative overflow-hidden border ${integration.borderColor} transition-all hover:shadow-md`}
                        >
                            <div className={`absolute right-0 top-0 size-24 rounded-full blur-3xl -z-10 opacity-20 ${integration.bgColor}`} />
                            <CardHeader>
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${integration.bgColor}`}>
                                        <Icon className={`size-6 ${integration.color}`} />
                                    </div>
                                    <div>
                                        <CardTitle>{integration.name}</CardTitle>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardDescription className="text-base mb-4">
                                    {integration.description}
                                </CardDescription>
                                <Button variant="outline" className="w-full">
                                    Learn More
                                </Button>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
