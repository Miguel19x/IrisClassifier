/**
 * Rich Text Editor Component using Tiptap
 * 
 * Provides Bold, Italic, Underline, and Alignment formatting options.
 */
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    AlignLeft,
    AlignCenter,
    AlignRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

interface RichTextEditorProps {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
}

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: false,
                bulletList: false,
                orderedList: false,
                blockquote: false,
                codeBlock: false,
                horizontalRule: false,
                // Disable hardBreak so Enter creates new paragraph instead of <br>
                // This allows each line to have its own alignment
                hardBreak: false,
            }),
            Underline,
            TextAlign.configure({
                types: ['paragraph'],
                alignments: ['left', 'center', 'right'],
            }),
        ],
        content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm dark:prose-invert max-w-none min-h-[120px] p-4 focus:outline-none',
            },
        },
    });

    // Sync content from parent
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content);
        }
    }, [content, editor]);

    if (!editor) {
        return (
            <div className="h-[180px] rounded-lg border border-border bg-secondary/30 animate-pulse" />
        );
    }

    return (
        <div className="rounded-lg border border-border overflow-hidden bg-background">
            {/* Toolbar */}
            <div className="flex items-center gap-1 p-2 border-b border-border bg-secondary/50">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={cn(editor.isActive('bold') && 'bg-primary/20 text-primary')}
                    title="Negrita"
                >
                    <Bold className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={cn(editor.isActive('italic') && 'bg-primary/20 text-primary')}
                    title="Cursiva"
                >
                    <Italic className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                    className={cn(editor.isActive('underline') && 'bg-primary/20 text-primary')}
                    title="Subrayado"
                >
                    <UnderlineIcon className="h-4 w-4" />
                </Button>

                <div className="w-px h-6 bg-border mx-2" />

                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => editor.chain().focus().setTextAlign('left').run()}
                    className={cn(editor.isActive({ textAlign: 'left' }) && 'bg-primary/20 text-primary')}
                    title="Alinear izquierda"
                >
                    <AlignLeft className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => editor.chain().focus().setTextAlign('center').run()}
                    className={cn(editor.isActive({ textAlign: 'center' }) && 'bg-primary/20 text-primary')}
                    title="Centrar"
                >
                    <AlignCenter className="h-4 w-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => editor.chain().focus().setTextAlign('right').run()}
                    className={cn(editor.isActive({ textAlign: 'right' }) && 'bg-primary/20 text-primary')}
                    title="Alinear derecha"
                >
                    <AlignRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Editor Area */}
            <div className="relative">
                <EditorContent editor={editor} />
                {!editor.getText() && placeholder && (
                    <div className="absolute top-4 left-4 text-muted-foreground pointer-events-none">
                        {placeholder}
                    </div>
                )}
            </div>
        </div>
    );
}
