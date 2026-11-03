/**
 * Monaco bundled with the app (no CDN) with the Jinja2 + Telegram HTML language of mailing
 * templates: highlighting and completion of the template variables.
 */
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/editor/editor.all.js";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import type { TemplateVariable } from "@/client/types.gen";

self.MonacoEnvironment = { getWorker: () => new EditorWorker() };
loader.config({ monaco });

export { monaco };

export const LANGUAGE = "jinja-telegram-html";
export const THEME = "jinja-telegram-html";

/** Variables and translation used by the completion provider, set by the editors. */
export const completionContext: {
  variables: TemplateVariable[];
  describe: (variable: TemplateVariable) => string;
} = { variables: [], describe: (variable) => variable.description };

const expression: monaco.languages.IMonarchLanguageRule[] = [
  [/"([^"\\]|\\.)*"/, "string"],
  [/'([^'\\]|\\.)*'/, "string"],
  [/\d+(\.\d+)?/, "number"],
  [
    /\b(if|elif|else|endif|for|endfor|in|not|and|or|is|set|endset|with|endwith|true|false|none|True|False|None)\b/,
    "keyword",
  ],
  [/\|\s*[a-zA-Z_]\w*/, "type"],
  [/[a-zA-Z_]\w*/, "variable"],
  [/[.()[\],:+\-*/%<>=!~]/, "delimiter"],
  [/\s+/, ""],
];

let registered = false;

export function registerLanguage(m: typeof monaco) {
  if (registered) return;
  registered = true;

  m.languages.register({ id: LANGUAGE });
  m.languages.setMonarchTokensProvider(LANGUAGE, {
    tokenizer: {
      root: [
        [/\{\{-?/, { token: "delimiter.jinja", next: "@expression" }],
        [/\{%-?/, { token: "delimiter.jinja", next: "@statement" }],
        [/\{#/, { token: "comment", next: "@comment" }],
        [/<\/?[a-zA-Z][\w-]*/, { token: "tag", next: "@tag" }],
        [/&(#\d+|[a-zA-Z]+);/, "string.escape"],
        [/[^<{&]+/, ""],
        [/./, ""],
      ],
      expression: [
        [/-?\}\}/, { token: "delimiter.jinja", next: "@pop" }],
        ...expression,
      ],
      statement: [
        [/-?%\}/, { token: "delimiter.jinja", next: "@pop" }],
        ...expression,
      ],
      comment: [
        [/#\}/, { token: "comment", next: "@pop" }],
        [/./, "comment"],
      ],
      tag: [
        [/\/?>/, { token: "tag", next: "@pop" }],
        [/[a-zA-Z][\w-]*/, "attribute.name"],
        [/=/, "delimiter"],
        [/"[^"]*"/, "attribute.value"],
        [/'[^']*'/, "attribute.value"],
        [/\{\{-?/, { token: "delimiter.jinja", next: "@expression" }],
        [/\s+/, ""],
      ],
    },
  });

  m.editor.defineTheme(THEME, {
    base: "vs",
    inherit: true,
    rules: [
      { token: "delimiter.jinja", foreground: "AF00DB", fontStyle: "bold" },
      { token: "variable", foreground: "001080" },
      { token: "keyword", foreground: "0000FF" },
      { token: "type", foreground: "267F99" },
      { token: "tag", foreground: "800000" },
      { token: "attribute.name", foreground: "E50000" },
      { token: "attribute.value", foreground: "0451A5" },
      { token: "string", foreground: "A31515" },
      { token: "string.escape", foreground: "EE0000" },
      { token: "number", foreground: "098658" },
      { token: "comment", foreground: "008000" },
    ],
    colors: {},
  });

  m.languages.registerCompletionItemProvider(LANGUAGE, {
    triggerCharacters: [".", "{", " ", "%"],
    provideCompletionItems(model, position) {
      const before = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });
      // Only inside {{ ... }} or {% ... %}
      const opened = Math.max(
        before.lastIndexOf("{{"),
        before.lastIndexOf("{%"),
      );
      const closed = Math.max(
        before.lastIndexOf("}}"),
        before.lastIndexOf("%}"),
      );
      if (opened === -1 || closed > opened) return { suggestions: [] };

      const match = /([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*\.)?([a-zA-Z_]\w*)?$/.exec(
        before,
      );
      const path = (match?.[1] ?? "").split(".").filter(Boolean);
      const word = match?.[2] ?? "";

      let candidates = completionContext.variables;
      for (const segment of path) {
        const variable = candidates.find((v) => v.name === segment);
        if (!variable) return { suggestions: [] };
        candidates = variable.fields ?? [];
      }

      const range = new m.Range(
        position.lineNumber,
        position.column - word.length,
        position.lineNumber,
        position.column,
      );
      return {
        suggestions: candidates.map((variable) => ({
          label: variable.name,
          kind:
            variable.type === "object"
              ? m.languages.CompletionItemKind.Module
              : m.languages.CompletionItemKind.Field,
          detail: `${variable.type}${variable.nullable ? " | None" : ""}`,
          documentation: completionContext.describe(variable),
          insertText: variable.name,
          range,
        })),
      };
    },
  });
}
