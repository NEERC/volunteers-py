import Editor, { type OnMount } from "@monaco-editor/react";
import { Box, CircularProgress } from "@mui/material";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useTemplateVariables } from "@/data/use-mailings";
import {
  completionContext,
  LANGUAGE,
  type monaco,
  registerLanguage,
  THEME,
} from "./monaco";

export type EditorError = { message: string; line?: number | null };

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** One-line field (button text and URL): Enter doesn't add lines. */
  singleLine?: boolean;
  height?: number;
  errors?: EditorError[];
  readOnly?: boolean;
  testId?: string;
};

const SINGLE_LINE_HEIGHT = 34;
const SINGLE_LINE_CONTEXT = "mailingSingleLineEditor";

export function TemplateEditor({
  value,
  onChange,
  singleLine = false,
  height = 220,
  errors = [],
  readOnly = false,
  testId,
}: Props) {
  const { t } = useTranslation();
  const { data: variables } = useTemplateVariables();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);

  useEffect(() => {
    if (variables) completionContext.variables = variables;
    completionContext.describe = (variable) =>
      [
        t(variable.description),
        variable.assignment_only ? t("Only with an assignment filter") : "",
      ]
        .filter(Boolean)
        .join(". ");
  }, [variables, t]);

  // Errors with a line number are shown in the editor
  useEffect(() => {
    const editor = editorRef.current;
    const m = monacoRef.current;
    const model = editor?.getModel();
    if (!m || !model) return;
    m.editor.setModelMarkers(
      model,
      "mailing",
      errors
        .filter((error) => error.line)
        .map((error) => ({
          severity: m.MarkerSeverity.Error,
          message: error.message,
          startLineNumber: error.line ?? 1,
          endLineNumber: error.line ?? 1,
          startColumn: 1,
          endColumn: model.getLineMaxColumn(error.line ?? 1),
        })),
    );
  }, [errors]);

  const onMount: OnMount = (editor, m) => {
    editorRef.current = editor;
    monacoRef.current = m as unknown as typeof monaco;
    if (singleLine) {
      // Commands are shared by all editors: the context key limits this one to one-line
      // editors. Enter still accepts a suggestion
      editor.createContextKey(SINGLE_LINE_CONTEXT, true);
      editor.addCommand(
        m.KeyCode.Enter,
        () => {},
        `${SINGLE_LINE_CONTEXT} && !suggestWidgetVisible`,
      );
    }
  };

  const editorHeight = singleLine ? SINGLE_LINE_HEIGHT : height;
  return (
    <Box
      data-testid={testId}
      sx={{
        border: 1,
        borderColor: errors.length ? "error.main" : "divider",
        borderRadius: 1,
        overflow: "hidden",
        height: editorHeight + 2,
        pt: singleLine ? 0 : 0.5,
      }}
    >
      <Editor
        height={editorHeight}
        language={LANGUAGE}
        theme={THEME}
        value={value}
        beforeMount={(m) => registerLanguage(m as unknown as typeof monaco)}
        onMount={onMount}
        onChange={(next) =>
          onChange(
            singleLine ? (next ?? "").replace(/\r?\n/g, "") : (next ?? ""),
          )
        }
        loading={<CircularProgress size={20} />}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: singleLine ? "off" : "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          autoClosingBrackets: "never",
          autoClosingQuotes: "never",
          autoSurround: "never",
          quickSuggestions: { other: true, strings: true, comments: false },
          fixedOverflowWidgets: true,
          renderLineHighlight: singleLine ? "none" : "line",
          ...(singleLine && {
            lineNumbers: "off",
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 6,
            lineNumbersMinChars: 0,
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            scrollbar: {
              vertical: "hidden",
              horizontal: "hidden",
              alwaysConsumeMouseWheel: false,
            },
            padding: { top: 7, bottom: 0 },
          }),
        }}
      />
    </Box>
  );
}
