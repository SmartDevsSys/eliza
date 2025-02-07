import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TypingStatusProvider } from "./contexts/typing-status";
import { AuthProvider } from "./contexts/auth-context";
import { AuthGuard } from "./components/auth-guard";
import Login from "./routes/auth/login";
import Register from "./routes/auth/register";
import AuthCallback from "./routes/auth/callback";
import Settings from "./routes/settings";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/app-sidebar";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/toaster";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Chat from "./routes/chat";
import Overview from "./routes/overview";
import Dashboard from "./routes/dashboard";
import Search from "./routes/search";
import Create from "./routes/create";
import Deploy from "./routes/deploy";
import AgentStatus from "./routes/agent-status";
import Integrations from "./routes/integrations";
import useVersion from "./hooks/use-version";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: Number.POSITIVE_INFINITY,
        },
    },
});

function App() {
    useVersion();
    return (
        <QueryClientProvider client={queryClient}>
            <TypingStatusProvider>
                <div className="dark antialiased" style={{ colorScheme: "dark" }}>
                    <BrowserRouter>
                        <AuthProvider>
                            <TooltipProvider delayDuration={0}>
                                <Routes>
                                    {/* Public auth routes */}
                                    <Route path="/auth/*" element={
                                        <div className="flex min-h-screen items-center justify-center bg-background">
                                            <Routes>
                                                <Route path="login" element={<Login />} />
                                                <Route path="register" element={<Register />} />
                                                <Route path="callback" element={<AuthCallback />} />
                                            </Routes>
                                        </div>
                                    } />

                                    {/* Protected routes */}
                                    <Route path="/*" element={
                                        <AuthGuard>
                                            <SidebarProvider>
                                                <AppSidebar />
                                                <SidebarInset>
                                                    <div className="flex flex-1 flex-col gap-4 size-full container">
                                                        <Routes>
                                                            <Route path="/" element={<Dashboard />} />
                                                            <Route path="search" element={<Search />} />
                                                            <Route path="create" element={<Create />} />
                                                            <Route path="deploy" element={<Deploy />} />
                                                            <Route path="chat/:agentId" element={<Chat />} />
                                                            <Route path="settings" element={<Settings />} />
                                                            <Route path="settings/:agentId" element={<Overview />} />
                                                            <Route path="integrations" element={<Integrations />} />
                                                            <Route path="agents/:agentId/status" element={<AgentStatus />} />
                                                        </Routes>
                                                    </div>
                                                </SidebarInset>
                                            </SidebarProvider>
                                        </AuthGuard>
                                    } />
                                </Routes>
                                <Toaster />
                            </TooltipProvider>
                        </AuthProvider>
                    </BrowserRouter>
                </div>
            </TypingStatusProvider>
        </QueryClientProvider>
    );
}

export default App;
