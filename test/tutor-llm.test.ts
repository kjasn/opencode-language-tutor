import { expect, test } from "bun:test";
import { checkWriting, parseWritingIssues } from "../src/tutor-llm.ts";

test("checkWriting requests native-language advice and high-impact corrections", async () => {
    let systemPrompt = "";
    const client = {
        session: {
            create: async () => ({ data: { id: "temporary-session" } }),
            prompt: async (input: { body: { system: string } }) => {
                systemPrompt = input.body.system;
                return {
                    data: {
                        parts: [
                            {
                                type: "text",
                                text: "spelling|u|you",
                            },
                        ],
                    },
                };
            },
            delete: async () => ({}),
        },
    };

    const issues = await checkWriting(
        client as never,
        "hello, who are u",
        {
            learningLang: "en",
            nativeLang: "zh-CN",
            autoWriteCheck: true,
            autoTranslate: false,
        },
        { providerID: "test", modelID: "model" },
    );

    expect(systemPrompt).toContain("native en speaker reviewing a learner's writing");
    expect(systemPrompt).toContain("Learner's native language is zh-CN");
    expect(systemPrompt).toContain(
        "Only suggest a correction when the expression would make a native speaker uncomfortable",
    );
    expect(systemPrompt).toContain('["grammar","spelling","word choice","optimization"]');
    expect(systemPrompt).toContain("capitalization (unless it is a proper noun)");
    expect(systemPrompt).toContain('reply with exactly "OK" when there is no useful correction');
    expect(systemPrompt).toContain("<correctionType>|<original>|<corrected>");
    expect(systemPrompt).toContain(
        'choose exactly one lowercase identifier from: ["grammar","spelling","word choice","optimization"]',
    );
    expect(issues).toEqual([{ correctionType: "拼写错误", original: "u", corrected: "you" }]);
});

test("checkWriting rejects an original span not present in the input", async () => {
    const client = {
        session: {
            create: async () => ({ data: { id: "temporary-session" } }),
            prompt: async () => ({
                data: {
                    parts: [
                        {
                            type: "text",
                            text: "optimization|missing text|better text",
                        },
                    ],
                },
            }),
            delete: async () => ({}),
        },
    };

    const issues = await checkWriting(
        client as never,
        "hello, who are u",
        {
            learningLang: "en",
            nativeLang: "zh-CN",
            autoWriteCheck: true,
            autoTranslate: false,
        },
        { providerID: "test", modelID: "model" },
    );

    expect(issues).toEqual([]);
});

test("parseWritingIssues keeps up to three complete line-protocol corrections", () => {
    const response = [
        "spelling|langauge|language",
        "grammar|in Monday|on Monday",
        "spelling|advices|advice",
        "optimization|very very good|excellent",
    ].join("\n");

    expect(parseWritingIssues(response, "zh-CN")).toEqual([
        { correctionType: "拼写错误", original: "langauge", corrected: "language" },
        { correctionType: "语法错误", original: "in Monday", corrected: "on Monday" },
        { correctionType: "拼写错误", original: "advices", corrected: "advice" },
    ]);
});

test("parseWritingIssues accepts localized correction types and ignores malformed lines", () => {
    const response = ["optimization|very very good|excellent", "spelling|langauge"].join("\n");

    expect(parseWritingIssues(response, "zh-CN")).toEqual([
        { correctionType: "表达优化", original: "very very good", corrected: "excellent" },
    ]);
});

test("parseWritingIssues accepts the no-correction marker", () => {
    expect(parseWritingIssues("OK", "zh-CN")).toEqual([]);
});
