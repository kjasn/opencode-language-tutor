import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type WritingIssue = {
    /** A short, user-facing category label in the user's native language. */
    correctionType: string;
    original: string;
    corrected: string;
};

export type TutorSessionState = {
    writing?: {
        sourceMessageID: string;
        issues: WritingIssue[];
        updatedAt: number;
    };
    translation?: {
        sourceMessageID: string;
        status: "pending" | "ready" | "error";
        text?: string;
        updatedAt: number;
    };
    /**
     * Completed translations are retained so they can be reviewed from the TUI
     * instead of disappearing with a notification.
     */
    translations?: TranslationResult[];
};

export type TranslationResult = {
    sourceMessageID: string;
    text: string;
    updatedAt: number;
};

function defaultStatePath(): string {
    const stateHome = process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state");
    return join(stateHome, "opencode", "language-tutor.json");
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
    return isRecord(error) && error.code === "ENOENT";
}

/**
 * A tiny file bridge between the server plugin (which performs LLM calls) and
 * the TUI plugin (which renders their results). Results are per OpenCode session.
 */
export class TutorStateStore {
    private writeQueue = Promise.resolve();

    constructor(private readonly path = defaultStatePath()) {}

    async load(sessionID: string): Promise<TutorSessionState | undefined> {
        try {
            const data: unknown = JSON.parse(await readFile(this.path, "utf8"));
            if (!isRecord(data) || !isRecord(data[sessionID])) return undefined;
            return data[sessionID] as TutorSessionState;
        } catch (error) {
            if (isMissingFileError(error) || error instanceof SyntaxError) return undefined;
            throw error;
        }
    }

    async update(sessionID: string, change: Partial<TutorSessionState>): Promise<void> {
        const write = this.writeQueue.then(async () => {
            const all = await this.loadAll();
            all[sessionID] = { ...all[sessionID], ...change };
            await this.saveAll(all);
        });
        // Keep later writes usable if one filesystem operation fails.
        this.writeQueue = write.catch(() => undefined);
        return write;
    }

    async recordTranslation(sessionID: string, translation: TranslationResult): Promise<void> {
        const write = this.writeQueue.then(async () => {
            const all = await this.loadAll();
            const current = all[sessionID] ?? {};
            const previous = current.translations ?? [];
            const withoutCurrent = previous.filter((item) => item.sourceMessageID !== translation.sourceMessageID);

            all[sessionID] = {
                ...current,
                translation: { ...translation, status: "ready" },
                // Keep the panel useful without letting the state file grow indefinitely.
                translations: [...withoutCurrent, translation].slice(-20),
            };
            await this.saveAll(all);
        });
        this.writeQueue = write.catch(() => undefined);
        return write;
    }

    private async loadAll(): Promise<Record<string, TutorSessionState>> {
        try {
            const data: unknown = JSON.parse(await readFile(this.path, "utf8"));
            return isRecord(data) ? (data as Record<string, TutorSessionState>) : {};
        } catch (error) {
            if (isMissingFileError(error) || error instanceof SyntaxError) return {};
            throw error;
        }
    }

    private async saveAll(data: Record<string, TutorSessionState>): Promise<void> {
        const directory = dirname(this.path);
        const temporaryPath = `${this.path}.${process.pid}.tmp`;
        await mkdir(directory, { recursive: true });
        await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
        await rename(temporaryPath, this.path);
    }
}
