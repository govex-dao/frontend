import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { ReactNode } from "react";

const STORAGE_KEY = "govex_favorite_orgs";

interface FavoritesContextValue {
    favorites: string[];
    toggleFavorite: (daoId: string) => void;
    isFavorited: (daoId: string) => boolean;
    addFavorite: (daoId: string) => void;
    removeFavorite: (daoId: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
    const [favorites, setFavorites] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error("Error loading favorites from localStorage:", error);
            return [];
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
        } catch (error) {
            console.error("Error saving favorites to localStorage:", error);
        }
    }, [favorites]);

    const toggleFavorite = useCallback((daoId: string) => {
        setFavorites((prev) => (prev.includes(daoId) ? prev.filter((id) => id !== daoId) : [...prev, daoId]));
    }, []);

    const isFavorited = useCallback((daoId: string) => favorites.includes(daoId), [favorites]);

    const addFavorite = useCallback((daoId: string) => {
        setFavorites((prev) => (prev.includes(daoId) ? prev : [...prev, daoId]));
    }, []);

    const removeFavorite = useCallback((daoId: string) => {
        setFavorites((prev) => prev.filter((id) => id !== daoId));
    }, []);

    const value = useMemo(
        () => ({ favorites, toggleFavorite, isFavorited, addFavorite, removeFavorite }),
        [favorites, toggleFavorite, isFavorited, addFavorite, removeFavorite]
    );

    return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
    const ctx = useContext(FavoritesContext);
    if (!ctx) {
        throw new Error("useFavorites must be used within a FavoritesProvider");
    }
    return ctx;
}
