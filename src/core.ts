import type { Part } from "@opencode-ai/sdk";

export function getPromptText(parts: Part[]): string {
    return parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n")
        .trim();
}

export function shouldCheckPrompt(text: string): boolean {
    const words = text.trim().split(/\s+/);

    if (text.startsWith("/") || text.startsWith("!")) return false;
    if (words.length < 4) return false;
    if (text.includes("```")) return false;

    return true;
}
