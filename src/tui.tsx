import type { TuiPluginModule } from "@opencode-ai/plugin/tui";
import { createSignal } from "solid-js";
import { DEFAULT_SETTINGS, LANGUAGES, SettingsStore } from "./setting.ts";
import { TutorStateStore, type TranslationResult, type TutorSessionState } from "./tutor-state.ts";

type TuiApi = Parameters<TuiPluginModule["tui"]>[0];

const settingsStore = new SettingsStore();
const tutorStateStore = new TutorStateStore();

function settingLabel(enabled: boolean): string {
  return enabled ? "On" : "Off";
}

async function saveSettingsChange(api: TuiApi, changes: Parameters<SettingsStore["update"]>[0]): Promise<void> {
  try {
    await settingsStore.update(changes);
    api.ui.toast({ message: "Language Tutor settings saved", variant: "success" });
    await openSettingsDialog(api);
  } catch {
    api.ui.toast({ message: "Could not save Language Tutor settings", variant: "error" });
  }
}

function openLanguageDialog(api: TuiApi, field: "learningLang" | "nativeLang"): void {
  const title = field === "learningLang" ? "Learning language" : "Native language";

  api.ui.dialog.replace(() => (
    <api.ui.DialogSelect
      title={title}
      options={LANGUAGES.map((language) => ({
        title: language.name,
        description: language.code,
        value: language.code,
      }))}
      onSelect={(option) => {
        void saveSettingsChange(api, { [field]: option.value });
      }}
    />
  ));
}

function openModelDialog(api: TuiApi, field: "writingCheckModel" | "translationModel"): void {
  const title = field === "writingCheckModel" ? "Writing-check model" : "Translation model";
  const configuredModels = api.state.provider
    .filter((provider) => provider.source === "config")
    .flatMap((provider) =>
      Object.values(provider.models)
        .filter(
          (model) => model.status !== "deprecated" && model.capabilities.input.text && model.capabilities.output.text,
        )
        .map((model) => ({
          title: model.name,
          description: `${provider.name} · ${model.id}`,
          value: `${provider.id}/${model.id}`,
        })),
    )
    .sort((left, right) => left.title.localeCompare(right.title));

  api.ui.dialog.replace(() => (
    <api.ui.DialogSelect
      title={title}
      options={[
        {
          title: "Use current session model",
          description: "No separate model is configured",
          value: "",
        },
        ...configuredModels,
      ]}
      onSelect={(option) => {
        void saveSettingsChange(api, { [field]: option.value || undefined });
      }}
    />
  ));
}

async function openSettingsDialog(api: TuiApi): Promise<void> {
  const settings = await settingsStore.load();

  api.ui.dialog.replace(() => (
    <api.ui.DialogSelect
      title="Language Tutor settings"
      options={[
        {
          title: "Learning language",
          description: settings.learningLang,
          value: "learning-language",
        },
        {
          title: "Native language",
          description: settings.nativeLang,
          value: "native-language",
        },
        {
          title: "Writing check",
          description: settingLabel(settings.autoWriteCheck),
          value: "writing-check",
        },
        {
          title: "Auto-translate",
          description: settingLabel(settings.autoTranslate),
          value: "auto-translate",
        },
        {
          title: "Writing-check model",
          description: settings.writingCheckModel ?? "Session model",
          value: "writing-model",
        },
        {
          title: "Translation model",
          description: settings.translationModel ?? "Session model",
          value: "translation-model",
        },
        {
          title: "Reset all settings",
          description: "Restore the defaults",
          value: "reset",
        },
      ]}
      onSelect={(option) => {
        switch (option.value) {
          case "learning-language":
            openLanguageDialog(api, "learningLang");
            break;
          case "native-language":
            openLanguageDialog(api, "nativeLang");
            break;
          case "writing-check":
            void saveSettingsChange(api, { autoWriteCheck: !settings.autoWriteCheck });
            break;
          case "auto-translate":
            void saveSettingsChange(api, { autoTranslate: !settings.autoTranslate });
            break;
          case "writing-model":
            openModelDialog(api, "writingCheckModel");
            break;
          case "translation-model":
            openModelDialog(api, "translationModel");
            break;
          case "reset":
            void saveSettingsChange(api, { ...DEFAULT_SETTINGS });
            break;
        }
      }}
    />
  ));
}

function translationTitle(translation: TranslationResult): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(translation.updatedAt);
}

/**
 * Keep the prompt area readable; the full translation remains in the history dialog.
 * TODO: Replace the static folded-block notice with an OpenTUI expand/collapse control.
 */
export function foldLongCodeBlocks(text: string, visibleLines = 3): string {
  return text.replace(/```([^\n]*)\n([\s\S]*?)```/g, (_block, language: string, body: string) => {
    const lines = body.replace(/\n$/, "").split("\n");
    if (lines.length <= visibleLines) return _block;

    const hiddenLines = lines.length - visibleLines;
    return `\`\`\`${language}\n${lines.slice(0, visibleLines).join("\n")}\n… ${hiddenLines} more line${hiddenLines === 1 ? "" : "s"} folded; open /translations to view all\n\`\`\``;
  });
}

async function openTranslationsDialog(api: TuiApi): Promise<void> {
  const sessionID = currentSessionID(api);
  const translations = sessionID ? ((await tutorStateStore.load(sessionID))?.translations ?? []) : [];

  if (!translations.length) {
    api.ui.dialog.replace(() => (
      <api.ui.DialogAlert title="Translations" message="No completed translations in this session yet." />
    ));
    return;
  }

  api.ui.dialog.replace(() => (
    <api.ui.DialogSelect
      title="Translations"
      options={[...translations].reverse().map((translation) => ({
        title: translationTitle(translation),
        description: translation.text.replace(/\s+/g, " ").slice(0, 120),
        value: translation,
      }))}
      onSelect={(option) => {
        api.ui.dialog.replace(() => <api.ui.DialogAlert title="Assistant translation" message={option.value.text} />);
      }}
    />
  ));
}

function currentSessionID(api: TuiApi): string | undefined {
  const route = api.route.current;
  return route.name === "session" && typeof route.params?.sessionID === "string" ? route.params.sessionID : undefined;
}

const plugin: TuiPluginModule = {
  id: "language-tutor-tui",
  tui: async (api) => {
    // A slot renderer is mounted once. Keep its state in a Solid signal so
    // translation updates change the mounted UI instead of only requesting a
    // terminal redraw with the original empty closure.
    const [state, setState] = createSignal<TutorSessionState | undefined>();
    let lastSessionID: string | undefined;
    const requestRender = () => api.renderer.requestRender();
    const stopListeningForMessages = api.event.on("message.updated", requestRender);
    const stopListeningForParts = api.event.on("message.part.updated", requestRender);

    api.lifecycle.onDispose(() => {
      stopListeningForMessages();
      stopListeningForParts();
    });

    const stateRefreshTimer = setInterval(() => {
      const sessionID = currentSessionID(api);
      if (!sessionID) {
        setState(undefined);
        lastSessionID = undefined;
        return;
      }
      void tutorStateStore.load(sessionID).then((next) => {
        if (sessionID !== currentSessionID(api)) return;
        if (sessionID !== lastSessionID || JSON.stringify(next) !== JSON.stringify(state())) {
          setState(next);
          lastSessionID = sessionID;
          requestRender();
        }
      });
    }, 500);
    api.lifecycle.onDispose(() => clearInterval(stateRefreshTimer));

    const unregisterSettingsCommand = api.command?.register(() => [
      {
        title: "Language Tutor translations",
        value: "language-tutor.translations",
        description: "Browse completed assistant translations in this session",
        slash: { name: "translations" },
        onSelect: () => openTranslationsDialog(api),
      },
      {
        title: "Language Tutor settings",
        value: "language-tutor.settings",
        description: "Configure languages, models, and automatic behavior",
        slash: { name: "lang-tu" },
        onSelect: () => openSettingsDialog(api),
      },
    ]);

    if (unregisterSettingsCommand) api.lifecycle.onDispose(unregisterSettingsCommand);

    api.slots.register({
      slots: {
        // Recompose the stock prompt so the tutor output is adjacent to it.
        // OpenCode does not expose a slot inside historical transcript messages.
        session_prompt: (_context, props) => {
          return (
            <box flexDirection="column">
              <api.ui.Prompt
                sessionID={props.session_id}
                visible={props.visible}
                disabled={props.disabled}
                onSubmit={props.on_submit}
                ref={props.ref}
              />
              {state()?.translation && (
                <box flexDirection="column" paddingLeft={2} paddingTop={1}>
                  <text attributes={1}>Latest assistant translation</text>
                  <text fg={api.theme.current.textMuted}>
                    {state()?.translation?.status === "pending"
                      ? "Translating…"
                      : state()?.translation?.status === "ready"
                        ? foldLongCodeBlocks(state()?.translation?.text ?? "Translation unavailable.")
                        : "Translation failed. Check the selected model in /lang-tu."}
                  </text>
                  {state()?.translation?.status === "ready" && (
                    <text fg={api.theme.current.textMuted}>Browse all: /translations</text>
                  )}
                </box>
              )}
            </box>
          );
        },
      },
    });
  },
};

export default plugin;
