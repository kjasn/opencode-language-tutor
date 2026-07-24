import { expect, test } from "bun:test";
import { foldLongCodeBlocks } from "../src/tui.tsx";

test("foldLongCodeBlocks preserves short fenced blocks", () => {
    const text = "Before\n```ts\nconst a = 1;\nconst b = 2;\n```\nAfter";

    expect(foldLongCodeBlocks(text)).toBe(text);
});

test("foldLongCodeBlocks folds fenced blocks longer than three lines", () => {
    const text = "```ts\n1\n2\n3\n4\n5\n```";

    expect(foldLongCodeBlocks(text)).toBe(
        "```ts\n1\n2\n3\n… 2 more lines folded; open /lang-translation to view all\n```",
    );
});
