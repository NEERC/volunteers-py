import Editor from "@monaco-editor/react";
import { CircularProgress } from "@mui/material";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { TemplateVariable } from "@/client/types.gen";
import { monaco } from "@/components/mailing/monaco";
import { useTemplateVariables } from "@/data/use-mailings";

const language = "typst";
let registered = false;

function registerTypst() {
  if (registered) return;
  registered = true;
  monaco.languages.register({ id: language });
  monaco.languages.setMonarchTokensProvider(language, {
    tokenizer: {
      root: [
        [/\/\/.*$/, "comment"],
        [/\/\*/, "comment", "@comment"],
        [/"(?:[^"\\]|\\.)*"/, "string"],
        [/#(?:let|set|show|import|include|if|for|while|return)\b/, "keyword"],
        [/#[\w-]+/, "type"],
        [/\b\d+(?:\.\d+)?(?:pt|mm|cm|in|em|fr|%)?/, "number"],
        [/\b(?:true|false|none|auto)\b/, "keyword"],
        [/[()[\]{},:]/, "delimiter"],
      ],
      comment: [
        [/\*\//, "comment", "@pop"],
        [/./, "comment"],
      ],
    },
  });
  monaco.languages.setLanguageConfiguration(language, {
    comments: { lineComment: "//", blockComment: ["/*", "*/"] },
    brackets: [
      ["(", ")"],
      ["[", "]"],
      ["{", "}"],
    ],
  });
}

function fieldsAt(variables: TemplateVariable[], parents: string[]) {
  let fields = variables;
  for (const parent of parents) {
    fields = fields.find((variable) => variable.name === parent)?.fields ?? [];
  }
  return fields;
}

type Props = {
  label: string;
  value: string;
  onChange: (next: string) => void;
  height?: number;
};

export function TypstEditor({ label, value, onChange, height = 560 }: Props) {
  const { t } = useTranslation();
  const { data: variables } = useTemplateVariables();
  const model = useRef<monaco.editor.ITextModel | null>(null);

  useEffect(() => {
    const provider = monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: ["."],
      provideCompletionItems: (current, position) => {
        if (current !== model.current) return { suggestions: [] };
        const prefix = current
          .getLineContent(position.lineNumber)
          .slice(0, position.column - 1);
        const chain = prefix
          .match(/([\w-]+(?:\.[\w-]+)*)\.[\w-]*$/)?.[1]
          ?.split(".");
        const lastDot = chain ? prefix.lastIndexOf(".") + 1 : undefined;
        const word = current.getWordUntilPosition(position);
        const range = new monaco.Range(
          position.lineNumber,
          lastDot === undefined ? word.startColumn : lastDot + 1,
          position.lineNumber,
          position.column,
        );

        const names = chain
          ? fieldsAt(variables ?? [], chain.slice(1))
          : (variables ?? []);
        return {
          suggestions: [
            ...names.map((variable) => ({
              label: variable.name,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: variable.name,
              detail: variable.type,
              documentation: t(variable.description),
              range,
            })),
            ...(!chain
              ? ["data", "render-each", "full-name"].map((name) => ({
                  label: name,
                  kind: monaco.languages.CompletionItemKind.Variable,
                  insertText: name,
                  range,
                }))
              : []),
          ],
        };
      },
    });
    return () => provider.dispose();
  }, [variables, t]);

  return (
    <Editor
      height={height}
      value={value}
      language={language}
      loading={<CircularProgress size={24} />}
      beforeMount={registerTypst}
      onMount={(editor) => {
        model.current = editor.getModel();
      }}
      onChange={(next) => onChange(next ?? "")}
      options={{
        ariaLabel: label,
        automaticLayout: true,
        minimap: { enabled: false },
        wordWrap: "on",
        scrollBeyondLastLine: false,
      }}
    />
  );
}
