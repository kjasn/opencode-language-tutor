# OpenCode Language Tutor

[English](README.md) | 简体中文

> 深受 [PI Language Tutor](https://github.com/mackt/pi-language-tutor) 启发

这是一个用于 [OpenCode](https://github.com/anomalyco/opencode) 的语言学习助手插件。它可以将智能体的回复翻译成你的母语，也可以检查你的提示词并提供最多三条实用的修改建议，帮助你更轻松地使用正在学习的语言与智能体交流。

> [!warning]
> 由于 OpenCode 未开放重新渲染历史回话的能力，因此插件无法做到在原文每个
> 段落下方显示翻译以及在用户提示词下方显示写做检查和建议。
> 当前插件仍处于开发阶段！

## 快速开始

### 使用 npm 安装

> [!note]
> 。。。

### 使用 Git

```bash
git clone https://github.com/kjasn/opencode-language-tutor.git

cd opencode-language-tutor

opencode
```

默认配置为：学习英语，并使用简体中文作为母语。
你可以通过 `/lang-tu` 命令修改设置。

写作检查默认启用，自动翻译默认关闭。如果希望在每次智能体回复后自动显示翻译，请在 `/lang-tu` 中启用 **Auto-translate（自动翻译）**。

### 使用本地大语言模型

<details>
<summary>使用 Ollama 本地模型快速、低成本地完成翻译任务。</summary>

例如，将以下配置添加到位于 `~/.config/opencode/opencode.json` 的 OpenCode 配置文件中：

详细说明请点击[这里](https://docs.ollama.com/integrations/opencode#opencode)。

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "ollama": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Ollama",
      "options": {
        "baseURL": "http://localhost:11434/v1"
      },
      "models": {
        "translategemma:4b-it-q4_K_M": {
          "name": "translategemma:4b-it-q4_K_M"
        }
      }
    }
  }
}
```

</details>

## 示例

写作检查结果会通过 OpenCode 的 toast 通知显示在界面**右上角**。翻译会显示在提示词下方；你可以使用 `/translations` 浏览当前会话中所有翻译。

## 更多细节

插件会检查符合条件的提示词，包括语法、拼写以及更自然的表达方式，并通过 OpenCode toast 显示最多三条实用建议。它还可以翻译智能体已完成的回复，并保存最近的翻译，供你通过 `/translations` 查看。你可以使用 `/lang-tu` 配置语言、功能开关以及可选的独立模型；如果未指定模型，插件将使用当前会话的模型。

这是一个轻量级辅助工具，而不是完整的语言教师：它不会重写整段提示词、评估语言水平、翻译用户提示词，也不会执行工具或命令。斜杠命令、过短的提示词以及代码块的内容会被跳过。_语言助手请求会在临时且独立的 OpenCode 会话中运行，并禁用所有工具，不占用上下文，不影响 Agent 记忆。_

### 无 tools calling

插件使用 `.opencode/agents/language-tutor.md` 处理隔离的语法检查和翻译请求。该文件中的 `tools: { "*": false }` 设置可以防止向仅用于翻译的模型发送工具 schema。此设置只影响插件的 `language-tutor` 智能体，不会影响你平时使用的 Build 或 Plan 智能体。

你可以在项目根目录运行以下命令，检查最终解析出的配置：

```sh
opencode debug config | rg -n -A12 -B2 '"language-tutor"'
```

## 发布

发布工作流仅在推送 `v*` 版本标签时运行。工作流会先对标签指向的提交运行类型检查和测试套件，然后再发布 Release。

如需发布 GitHub Release，请推送版本标签：

```sh
git tag v0.1.0
git push origin v0.1.0
```

推送 `v*` 标签后，工作流会创建带有自动生成发行说明以及 `.tar.gz` 和 `.zip` 源码归档的 GitHub Release。

## 待办事项

[ ] 将写作检查建议从 toast 通知改为**持久化**显示。

[ ] 以交互方式显示翻译，例如在**可滚动区域**中展示较长的翻译结果，并自动折叠大段的代码块。

[ ] ...
