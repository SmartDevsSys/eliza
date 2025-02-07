import { Button } from "@/components/ui/button";
import { Home as HomeIcon, Play } from "lucide-react";
import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";

export default function Home() {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2
            }
        }
    };

    const itemVariants = {
        hidden: { 
            opacity: 0,
            y: 20
        },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.8,
                ease: "easeOut"
            }
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center">
            <motion.div
                className="text-center max-w-3xl mx-auto px-4"
                initial="hidden"
                animate="visible"
                variants={containerVariants}
            >
                <motion.h1
                    className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300"
                    variants={itemVariants}
                >
                    Your AI Agents That Learn & Grow
                </motion.h1>
                
                <motion.p
                    className="text-lg sm:text-xl text-muted-foreground mb-8"
                    variants={itemVariants}
                >
                    Experience the next generation of AI assistance. Our agents don't just respond – 
                    they learn, adapt, and evolve to become your perfect digital companions.
                </motion.p>
                
                <motion.div
                    className="flex flex-wrap justify-center gap-4 mb-16"
                    variants={itemVariants}
                >
                    <NavLink to="/search">
                        <Button
                            size="lg"
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500"
                        >
                            <HomeIcon className="mr-2 h-4 w-4" />
                            Get Started Free
                        </Button>
                    </NavLink>
                    <Button
                        size="lg"
                        variant="outline"
                        className="border-white/20 hover:bg-white/10"
                    >
                        <Play className="mr-2 h-4 w-4" />
                        Watch Demo
                    </Button>
                </motion.div>
            </motion.div>
        </div>
    );
}
