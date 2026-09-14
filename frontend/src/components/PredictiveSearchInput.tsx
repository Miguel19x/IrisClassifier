/**
 * PredictiveSearchInput — Autocomplete search with Markov Chain suggestions.
 *
 * Replaces a standard Input with a dropdown of predictive suggestions
 * fetched from the backend Markov model as the user types.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Sparkles, Loader2 } from "lucide-react";
import api from "@/services/api";
import { cn } from "@/lib/utils";

interface PredictiveSearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    debounceMs?: number;
}

interface SuggestResponse {
    suggestions: string[];
    prefix: string;
    count: number;
}

export function PredictiveSearchInput({
    value,
    onChange,
    placeholder = "Buscar productos...",
    className,
    debounceMs = 300,
}: PredictiveSearchInputProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [activeIndex, setActiveIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Debounce the query for API calls
    useEffect(() => {
        if (!value || value.length < 2) {
            setDebouncedQuery("");
            return;
        }
        const timer = setTimeout(() => setDebouncedQuery(value), debounceMs);
        return () => clearTimeout(timer);
    }, [value, debounceMs]);

    // Fetch suggestions from Markov endpoint
    const { data, isFetching } = useQuery<SuggestResponse>({
        queryKey: ["markov-suggest", debouncedQuery],
        queryFn: async () => {
            const res = await api.get(`/markov/suggest`, {
                params: { q: debouncedQuery, limit: 8 },
            });
            return res.data;
        },
        enabled: debouncedQuery.length >= 2,
        staleTime: 60_000, // 1 min cache on client
        gcTime: 5 * 60_000,
    });

    const suggestions = data?.suggestions ?? [];

    // Show dropdown when we have suggestions
    useEffect(() => {
        if (suggestions.length > 0 && debouncedQuery.length >= 2) {
            setIsOpen(true);
            setActiveIndex(-1);
        } else {
            setIsOpen(false);
        }
    }, [suggestions, debouncedQuery]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = useCallback(
        (suggestion: string) => {
            onChange(suggestion);
            setIsOpen(false);
            inputRef.current?.focus();
        },
        [onChange]
    );

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen || suggestions.length === 0) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setActiveIndex((prev) =>
                    prev < suggestions.length - 1 ? prev + 1 : 0
                );
                break;
            case "ArrowUp":
                e.preventDefault();
                setActiveIndex((prev) =>
                    prev > 0 ? prev - 1 : suggestions.length - 1
                );
                break;
            case "Enter":
                if (activeIndex >= 0 && activeIndex < suggestions.length) {
                    e.preventDefault();
                    handleSelect(suggestions[activeIndex]);
                }
                break;
            case "Escape":
                setIsOpen(false);
                setActiveIndex(-1);
                break;
            case "Tab":
                if (activeIndex >= 0 && activeIndex < suggestions.length) {
                    e.preventDefault();
                    handleSelect(suggestions[activeIndex]);
                } else if (suggestions.length > 0) {
                    e.preventDefault();
                    handleSelect(suggestions[0]);
                }
                break;
        }
    };

    // Highlight matching prefix in suggestion text
    const highlightMatch = (text: string, prefix: string) => {
        const idx = text.toLowerCase().indexOf(prefix.toLowerCase());
        if (idx === -1) return <span>{text}</span>;

        return (
            <>
                <span>{text.slice(0, idx)}</span>
                <span className="text-primary font-semibold">
                    {text.slice(idx, idx + prefix.length)}
                </span>
                <span>{text.slice(idx + prefix.length)}</span>
            </>
        );
    };

    return (
        <div ref={containerRef} className="relative flex-1">
            {/* Search icon */}
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />

            {/* Loading / Markov indicator */}
            {isFetching ? (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin z-10" />
            ) : debouncedQuery.length >= 2 && suggestions.length > 0 ? (
                <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/60 z-10" />
            ) : null}

            {/* Input */}
            <input
                ref={inputRef}
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                    if (suggestions.length > 0 && value.length >= 2) {
                        setIsOpen(true);
                    }
                }}
                className={cn(
                    "flex h-11 w-full rounded-lg border border-border bg-input px-4 py-2 text-base text-foreground shadow-sm transition-all duration-300",
                    "placeholder:text-muted-foreground",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                    "hover:border-muted-foreground/50",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    "md:text-sm pl-10",
                    isOpen && "rounded-b-none border-b-transparent",
                    className
                )}
                role="combobox"
                aria-expanded={isOpen}
                aria-autocomplete="list"
                aria-controls="markov-suggestions"
                autoComplete="off"
            />

            {/* Suggestions dropdown */}
            {isOpen && suggestions.length > 0 && (
                <ul
                    id="markov-suggestions"
                    role="listbox"
                    className={cn(
                        "absolute z-50 w-full",
                        "bg-popover/95 backdrop-blur-xl",
                        "border border-border border-t-0 rounded-b-lg",
                        "shadow-lg shadow-black/10",
                        "max-h-[280px] overflow-y-auto",
                        "animate-in fade-in-0 slide-in-from-top-1 duration-200"
                    )}
                >
                    {/* Header */}
                    <li className="px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border/50 flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3" />
                        Sugerencias predictivas (Markov)
                    </li>

                    {suggestions.map((suggestion, idx) => (
                        <li
                            key={`${suggestion}-${idx}`}
                            role="option"
                            aria-selected={idx === activeIndex}
                            onClick={() => handleSelect(suggestion)}
                            onMouseEnter={() => setActiveIndex(idx)}
                            className={cn(
                                "px-4 py-2.5 cursor-pointer transition-all duration-150",
                                "text-sm font-mono text-foreground",
                                "border-b border-border/20 last:border-b-0",
                                idx === activeIndex
                                    ? "bg-primary/10 text-primary"
                                    : "hover:bg-secondary/60"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">
                                    {highlightMatch(suggestion, value)}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
