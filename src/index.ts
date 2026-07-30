import type { Plugin } from "@opencode-ai/plugin";
import { getPromptText, shouldCheckPrompt } from "./core.ts";
import { SettingsStore } from "./setting.ts";
import { checkWriting, translateResponse } from "./tutor-llm.ts";
import { TutorStateStore } from "./tutor-state.ts";

/**
 * Language Tutor Plugin
 */

export const LanguageTutorPlugin: Plugin = async ({ client }) => {
    const settingsStore = new SettingsStore();
    const tutorStateStore = new TutorStateStore();
    const temporarySessions = new Set<string>();
    const translatedMessageIDs = new Set<string>();

    return {
        event: async ({ event }) => {
            if (event.type !== "message.updated") return;
            const assistant = event.properties.info;
            if (
                assistant.role !== "assistant" ||
                !assistant.time.completed ||
                assistant.error ||
                temporarySessions.has(assistant.sessionID) ||
                translatedMessageIDs.has(assistant.id)
            ) {
                return;
            }
            translatedMessageIDs.add(assistant.id);
            void scheduleTranslation(assistant.sessionID, assistant.id, {
                providerID: assistant.providerID,
                modelID: assistant.modelID,
            });
        },

        "chat.message": async (input, output) => {
            if (temporarySessions.has(input.sessionID)) return;
            const text = getPromptText(output.parts);
            if (!shouldCheckPrompt(text)) return;

            const settings = await settingsStore.load();
            if (!settings.autoWriteCheck) return;
            void checkWritingInBackground(input.sessionID, output.message.id, text, output.message.model, settings);
        },
    };

    async function checkWritingInBackground(
        sessionID: string,
        messageID: string,
        text: string,
        model: { providerID: string; modelID: string },
        settings: Awaited<ReturnType<SettingsStore["load"]>>,
    ): Promise<void> {
        try {
            const startedAt = performance.now();
            await client.app.log({
                body: {
                    service: "language-tutor",
                    level: "info",
                    message: "[LT]Test msg before calling llm",
                },
            });

            const issues = await checkWriting(client, text, settings, model, trackTemporarySession);
            if (issues.length === 0) return;

            await tutorStateStore.update(sessionID, {
                writing: { sourceMessageID: messageID, issues, updatedAt: Date.now() },
            });
            const message = issues
                .map((issue) => `${issue.correctionType}: ${issue.original} -> ${issue.corrected}`)
                .join("\n");
            await client.tui.showToast({
                body: {
                    title: "Writing check",
                    message: message.slice(0, 180),
                    variant: "info",
                    duration: 8_000,
                },
            });

            await client.app.log({
                body: {
                    service: "language-tutor",
                    level: "info",
                    message: "[LT]after calling",
                    extra: {
                        duration: performance.now() - startedAt,
                        issues: issues,
                        model: settings.writingCheckModel ?? model.modelID,
                    },
                },
            });
        } catch {
            await client.tui.showToast({
                body: {
                    title: "Writing check",
                    message: "Could not check this prompt.",
                    variant: "warning",
                    duration: 4_000,
                },
            });
        }
    }

    async function translateInBackground(
        sessionID: string,
        messageID: string,
        text: string,
        model: { providerID: string; modelID: string },
        settings: Awaited<ReturnType<SettingsStore["load"]>>,
    ): Promise<void> {
        await tutorStateStore.update(sessionID, {
            translation: { sourceMessageID: messageID, status: "pending", updatedAt: Date.now() },
        });
        try {
            const translated = await translateResponse(client, text, settings, model, trackTemporarySession);
            await tutorStateStore.recordTranslation(sessionID, {
                sourceMessageID: messageID,
                text: translated,
                updatedAt: Date.now(),
            });
        } catch {
            await tutorStateStore.update(sessionID, {
                translation: { sourceMessageID: messageID, status: "error", updatedAt: Date.now() },
            });
        }
    }

    async function scheduleTranslation(
        sessionID: string,
        messageID: string,
        model: { providerID: string; modelID: string },
    ): Promise<void> {
        const settings = await settingsStore.load();
        if (!settings.autoTranslate) return;

        const message = await client.session.message({ path: { id: sessionID, messageID } });
        if (message.error || !message.data) return;
        const text = getPromptText(message.data.parts);
        if (!text) return;

        await translateInBackground(sessionID, messageID, text, model, settings);
    }

    function trackTemporarySession(sessionID: string, active: boolean): void {
        if (active) temporarySessions.add(sessionID);
        else temporarySessions.delete(sessionID);
    }
};
