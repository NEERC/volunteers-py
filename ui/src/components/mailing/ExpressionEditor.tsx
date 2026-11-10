import Editor, { type OnMount } from "@monaco-editor/react";
import { Box, CircularProgress } from "@mui/material";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useTemplateVariables } from "@/data/use-mailings";
import {
  completionContext,
  EXPRESSION_LANGUAGE,
  type monaco,
  registerLanguage,
  THEME,
} from "./monaco";
import type { EditorError } from "./TemplateEditor";

type Props = {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  errors?: EditorError[];
  testId?: string;
};

/** Editor of the sandboxed recipient filter expression (Python over the template context). */
export function ExpressionEditor({
  value,
  onChange,
  height = 100,
  errors = [],
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
  };

  return (
    <Box
      data-testid={testId}
      sx={{
        border: 1,
        borderColor: errors.length ? "error.main" : "divider",
        borderRadius: 1,
        overflow: "hidden",
        height: height + 2,
      }}
    >
      <Editor
        height={height}
        language={EXPRESSION_LANGUAGE}
        theme={THEME}
        value={value}
        beforeMount={(m) => registerLanguage(m as unknown as typeof monaco)}
        onMount={onMount}
        onChange={(next) => onChange(next ?? "")}
        loading={<CircularProgress size={20} />}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          wordWrap: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          lineNumbersMinChars: 3,
          quickSuggestions: { other: true, strings: true, comments: false },
          fixedOverflowWidgets: true,
          placeholder: 'form.extra_fields.get("lives_in_vyazma") == True',
        }}
      />
    </Box>
  );
}
