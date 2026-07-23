import type { Plugin } from "@opencode-ai/plugin";

/**
 * Language Tutor Plugin
 */

export const LanguageTutorPlugin: Plugin = async ({ client }) => {
    return {
        event: async ({ event }) => {
            if (event.type === "session.created") {
                await client.tui.showToast({
                    body: {
                        message: "Language Tutor loaded",
                        variant: "success",
                        duration: 3_000,
                    },
                });
            }
        },
    };
};
