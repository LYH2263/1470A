declare module 'react-quill' {
  import React from 'react';

  interface ReactQuillProps {
    value?: string;
    onChange?: (content: string, delta?: any, source?: string, editor?: any) => void;
    placeholder?: string;
    readOnly?: boolean;
    theme?: string;
    modules?: any;
    formats?: string[];
    style?: React.CSSProperties;
    ref?: React.Ref<any>;
  }

  interface ReactQuill extends React.Component<ReactQuillProps> {
    getEditor(): any;
  }

  const ReactQuill: React.ComponentClass<ReactQuillProps>;
  export default ReactQuill;
}

declare module 'highlight.js' {
  interface HLJSApi {
    highlightElement(element: HTMLElement): void;
    highlightBlock(element: HTMLElement): void;
    highlight(code: string, options?: { language: string }): { value: string };
    registerLanguage(name: string, language: any): void;
  }

  const hljs: HLJSApi;
  export default hljs;
  export const highlightElement: (element: HTMLElement) => void;
  export const highlightBlock: (element: HTMLElement) => void;
}

declare module 'quill-better-table' {
  interface QuillBetterTableOptions {
    contextMenu?: boolean;
    operationMenu?: {
      insertColumnRight?: {
        text: string;
      };
      insertColumnLeft?: {
        text: string;
      };
      insertRowUp?: {
        text: string;
      };
      insertRowDown?: {
        text: string;
      };
      mergeCells?: {
        text: string;
      };
      unmergeCells?: {
        text: string;
      };
      deleteColumn?: {
        text: string;
      };
      deleteRow?: {
        text: string;
      };
      deleteTable?: {
        text: string;
      };
    };
    keyboard?: boolean;
    tabsize?: number;
    resizable?: boolean;
  }

  class QuillBetterTable {
    static register(): void;
    constructor(quill: any, options: QuillBetterTableOptions);
    insertTable(rows: number, columns: number): void;
    deleteTable(): void;
    insertRowAbove(): void;
    insertRowBelow(): void;
    insertColumnLeft(): void;
    insertColumnRight(): void;
    deleteRow(): void;
    deleteColumn(): void;
    mergeCells(range?: any): void;
    unmergeCells(): void;
    getTable(range?: any): any;
    getSelectedRange(): any;
  }

  export default QuillBetterTable;
}
