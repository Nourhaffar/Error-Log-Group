import React, { useState, useEffect } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

/**
 * Modern, accessible dark mode toggle component.
 * Supports:
 * - System preference detection & live change listening
 * - Manual override (light / dark) persisted in localStorage
 * - Synchronization with <meta name="color-scheme"> and CSS color-scheme
 * - Multi-tab storage event synchronization
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("theme") || "system";
    } catch {
      return "system";
    }
  });

  // Apply theme to document and <meta name="color-scheme">
  const applyTheme = (targetTheme) => {
    try {
      const root = document.documentElement;
      const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const effectiveDark =
        targetTheme === "dark" || (targetTheme === "system" && isSystemDark);

      if (effectiveDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }

      // Sync <meta name="color-scheme">
      const meta = document.querySelector('meta[name="color-scheme"]');
      if (meta) {
        meta.content =
          targetTheme === "dark"
            ? "dark"
            : targetTheme === "light"
            ? "light"
            : "light dark";
      }

      if (targetTheme === "system") {
        localStorage.removeItem("theme");
      } else {
        localStorage.setItem("theme", targetTheme);
      }
    } catch (e) {
      console.warn("Failed to apply or persist theme:", e);
    }
  };

  const handleSelectTheme = (newTheme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  // Listen for system preference changes and storage events from other tabs
  useEffect(() => {
    applyTheme(theme);

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = (e) => {
      try {
        const stored = localStorage.getItem("theme");
        if (!stored || stored === "system") {
          if (e.matches) {
            document.documentElement.classList.add("dark");
          } else {
            document.documentElement.classList.remove("dark");
          }
        }
      } catch (err) {
        console.warn(err);
      }
    };

    const handleStorageChange = (e) => {
      if (e.key === "theme") {
        const newStored = e.newValue || "system";
        setTheme(newStored);
        applyTheme(newStored);
      }
    };

    mql.addEventListener("change", handleSystemChange);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      mql.removeEventListener("change", handleSystemChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  return (
    <div
      className="theme-toggle-group"
      role="radiogroup"
      aria-label="Color theme selection"
    >
      <button
        type="button"
        className={`theme-toggle-btn ${theme === "light" ? "active" : ""}`}
        onClick={() => handleSelectTheme("light")}
        role="radio"
        aria-checked={theme === "light"}
        title="Light theme"
        aria-label="Light theme"
      >
        <Sun size={15} strokeWidth={2} />
        <span className="theme-toggle-text">Light</span>
      </button>

      <button
        type="button"
        className={`theme-toggle-btn ${theme === "dark" ? "active" : ""}`}
        onClick={() => handleSelectTheme("dark")}
        role="radio"
        aria-checked={theme === "dark"}
        title="Dark theme"
        aria-label="Dark theme"
      >
        <Moon size={15} strokeWidth={2} />
        <span className="theme-toggle-text">Dark</span>
      </button>

      <button
        type="button"
        className={`theme-toggle-btn ${theme === "system" ? "active" : ""}`}
        onClick={() => handleSelectTheme("system")}
        role="radio"
        aria-checked={theme === "system"}
        title="System default"
        aria-label="System default"
      >
        <Monitor size={15} strokeWidth={2} />
        <span className="theme-toggle-text">Auto</span>
      </button>
    </div>
  );
}
