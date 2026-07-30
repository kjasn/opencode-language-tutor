import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const LANGUAGES = [
    { code: "en", name: "English" },
    { code: "zh-CN", name: "简体中文" },
    { code: "zh-TW", name: "繁體中文" },
    { code: "ja", name: "日本語" },
    { code: "ko", name: "한국어" },
    { code: "es", name: "Español" },
    { code: "fr", name: "Français" },
    { code: "de", name: "Deutsch" },
    { code: "pt", name: "Português" },
    { code: "ru", name: "Русский" },
] as const;

export type LanguageTutorSettings = {
    /** Language the user is practising in their prompts. */
    learningLang: string;
    /** Language used for explanations and translations. */
    nativeLang: string;
    /** Whether writing checks run automatically for eligible user prompts. */
    autoWriteCheck: boolean;
    /** Whether completed assistant responses are translated automatically. */
    autoTranslate: boolean;
    /** Optional provider/model ID for writing checks; falls back to the session model. */
    writingCheckModel?: string;
    /** Optional provider/model ID for translations; falls back to the session model. */
    translationModel?: string;
};

export const DEFAULT_SETTINGS: Readonly<LanguageTutorSettings> = {
    learningLang: "en",
    nativeLang: "zh-CN",
    autoWriteCheck: true,
    autoTranslate: false,
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function optionalBoolean(value: unknown): boolean | undefined {
    return typeof value === "boolean" ? value : undefined;
}

export function parseSettings(value: unknown): LanguageTutorSettings {
    const raw = isRecord(value) ? value : {};

    return {
        learningLang:
            optionalString(raw.learningLang) ?? optionalString(raw.learningLanguage) ?? DEFAULT_SETTINGS.learningLang,
        nativeLang: optionalString(raw.nativeLang) ?? optionalString(raw.nativeLanguage) ?? DEFAULT_SETTINGS.nativeLang,
        autoWriteCheck:
            optionalBoolean(raw.autoWriteCheck) ??
            optionalBoolean(raw.writingCheckEnabled) ??
            DEFAULT_SETTINGS.autoWriteCheck,
        autoTranslate: optionalBoolean(raw.autoTranslate) ?? DEFAULT_SETTINGS.autoTranslate,
        writingCheckModel: optionalString(raw.writingCheckModel) ?? optionalString(raw.writingModel),
        translationModel: optionalString(raw.translationModel),
    };
}

export function defaultSettingsPath(): string {
    // Use XDG_CONFIG_HOME if set, otherwise default to ~/.config
    const configHome = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
    return join(configHome, "opencode", "language-tutor.json");
}

export class SettingsStore {
    constructor(private readonly path = defaultSettingsPath()) {}

    async load(): Promise<LanguageTutorSettings> {
        try {
            return parseSettings(JSON.parse(await readFile(this.path, "utf8")));
        } catch (error) {
            if (isMissingFileError(error) || error instanceof SyntaxError) return { ...DEFAULT_SETTINGS };
            throw error;
        }
    }

    async save(settings: LanguageTutorSettings): Promise<void> {
        const directory = dirname(this.path);
        const temporaryPath = `${this.path}.${process.pid}.tmp`;

        await mkdir(directory, { recursive: true });
        await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
        await rename(temporaryPath, this.path);
    }

    async update(changes: Partial<LanguageTutorSettings>): Promise<LanguageTutorSettings> {
        const next = { ...(await this.load()), ...changes };
        await this.save(next);
        return next;
    }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
    return isRecord(error) && error.code === "ENOENT";
}
