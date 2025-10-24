import { useRef } from "react"
import Editor, { type Monaco } from "@monaco-editor/react"
import type { editor } from "monaco-editor"


interface JsonEditorProps {
  value: string
  onChange?: (value: string) => void
  onValidate?: (isValid: boolean, error?: string) => void
  schema?: object
  height?: string
  readOnly?: boolean
  className?: string
}

/**
 * JSON 编辑器组件
 * 基于 Monaco Editor，支持 JSON 语法高亮、验证和格式化
 */
export function JsonEditor({
  value,
  onChange,
  onValidate,
  schema,
  height = "100%",
  readOnly = false,
  className = "",
}: JsonEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const handleEditorDidMount = (
    editor: editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    editorRef.current = editor

    // 配置 JSON 语言支持
    if (schema) {
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemas: [
          {
            uri: "http://json-schema.org/draft-07/schema#",
            fileMatch: ["*"],
            schema,
          },
        ],
        enableSchemaRequest: false,
      })
    }

    // 初始验证
    validateJson(value)
  }

  const handleEditorChange = (newValue: string | undefined) => {
    const value = newValue ?? ""
    validateJson(value)
    onChange?.(value)
  }

  const validateJson = (jsonString: string) => {
    if (!onValidate) return

    try {
      JSON.parse(jsonString)
      onValidate(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Invalid JSON"
      onValidate(false, errorMessage)
    }
  }

  return (
    <div className={className} style={{ height }}>
      <Editor
        height={height}
        defaultLanguage="json"
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          readOnly,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 14,
          lineNumbers: "on",
          renderWhitespace: "selection",
          formatOnPaste: true,
          formatOnType: true,
          tabSize: 2,
          automaticLayout: true,
          wordWrap: "on",
          folding: true,
          bracketPairColorization: {
            enabled: true,
          },
        }}
      />
    </div>
  )
}
