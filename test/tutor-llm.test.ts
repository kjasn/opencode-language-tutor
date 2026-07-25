import { expect, test } from "bun:test";
import { parseWritingIssues } from "../src/tutor-llm.ts";

test("parseWritingIssues keeps up to three valid corrections", () => {
    const response = JSON.stringify({
        issues: [
            { original: "go", suggestion: "goes", reason: "主语是第三人称单数。" },
            { original: "in Monday", suggestion: "on Monday", reason: "日期前使用 on。" },
            { original: "advices", suggestion: "advice", reason: "advice 不可数。" },
            { original: "furnitures", suggestion: "furniture", reason: "furniture 不可数。" },
        ],
    });

    expect(parseWritingIssues(response)).toEqual([
        { original: "go", suggestion: "goes", reason: "主语是第三人称单数。" },
        { original: "in Monday", suggestion: "on Monday", reason: "日期前使用 on。" },
        { original: "advices", suggestion: "advice", reason: "advice 不可数。" },
    ]);
});
