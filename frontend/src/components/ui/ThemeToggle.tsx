import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        const savedTheme = localStorage.getItem("theme");
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

        if (savedTheme === "light" || (!savedTheme && !prefersDark)) {
            setIsDark(false);
            document.documentElement.classList.add("light");
        } else {
            setIsDark(true);
            document.documentElement.classList.remove("light");
        }
    }, []);

    const toggleTheme = () => {
        const newIsDark = !isDark;
        setIsDark(newIsDark);

        if (newIsDark) {
            document.documentElement.classList.remove("light");
            localStorage.setItem("theme", "dark");
        } else {
            document.documentElement.classList.add("light");
            localStorage.setItem("theme", "light");
        }
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="relative overflow-hidden"
            aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
            <div
                className="absolute transition-all duration-300 ease-in-out"
                style={{
                    transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(180deg) scale(0)',
                    opacity: isDark ? 1 : 0
                }}
            >
                <Moon className="h-5 w-5" />
            </div>
            <div
                className="absolute transition-all duration-300 ease-in-out"
                style={{
                    transform: isDark ? 'rotate(-180deg) scale(0)' : 'rotate(0deg) scale(1)',
                    opacity: isDark ? 0 : 1
                }}
            >
                <Sun className="h-5 w-5" />
            </div>
        </Button>
    );
}
