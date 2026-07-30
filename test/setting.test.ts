import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_SETTINGS, parseSettings, SettingsStore } from "../src/setting.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
    await Promise.all(
        temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })),
    );
});

describe("parseSettings", () => {
    test("uses defaults for malformed input", () => {
        expect(parseSettings("not JSON")).toEqual(DEFAULT_SETTINGS);
    });

    test("keeps valid user settings and ignores invalid fields", () => {
        expect(
            parseSettings({
                learningLanguage: "ja",
                nativeLanguage: "en",
                autoWriteCheck: false,
                autoTranslate: true,
                writingModel: "openai/gpt-5-mini",
                translationModel: 42,
            }),
        ).toEqual({
            learningLang: "ja",
            nativeLang: "en",
            autoWriteCheck: false,
            autoTranslate: true,
            writingCheckModel: "openai/gpt-5-mini",
            translationModel: undefined,
        });
    });

    test("migrates the previous writing-check option", () => {
        expect(parseSettings({ writingCheckEnabled: false })).toEqual({
            ...DEFAULT_SETTINGS,
            autoWriteCheck: false,
            writingCheckModel: undefined,
            translationModel: undefined,
        });
    });
});

describe("SettingsStore", () => {
    test("loads defaults, then persists updates", async () => {
        const directory = await mkdtemp(join(tmpdir(), "language-tutor-settings-"));
        temporaryDirectories.push(directory);
        const store = new SettingsStore(join(directory, "language-tutor.json"));

        expect(await store.load()).toEqual(DEFAULT_SETTINGS);

        await store.update({ autoTranslate: true, nativeLang: "ja" });

        expect(await store.load()).toEqual({ ...DEFAULT_SETTINGS, autoTranslate: true, nativeLang: "ja" });
        expect(JSON.parse(await readFile(join(directory, "language-tutor.json"), "utf8"))).toMatchObject({
            autoTranslate: true,
            nativeLang: "ja",
        });
    });
});
