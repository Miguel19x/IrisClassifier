/**
 * Template Dropzone Component
 * 
 * Drag & Drop zone for uploading Excel or PDF templates.
 */
import { useState, useCallback, useRef } from 'react';
import {
    FileSpreadsheet,
    FileText,
    Upload,
    X,
    CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TemplateFile } from '@/contexts/ExportConfigContext';

interface TemplateDropzoneProps {
    template: TemplateFile | null;
    onTemplateChange: (file: TemplateFile) => void;
    onTemplateClear: () => void;
}

export function TemplateDropzone({
    template,
    onTemplateChange,
    onTemplateClear,
}: TemplateDropzoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback(async (file: File) => {
        const validTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
        ];

        const extension = file.name.split('.').pop()?.toLowerCase();
        const isValidExtension = ['pdf', 'xlsx', 'xls'].includes(extension || '');

        if (!validTypes.includes(file.type) && !isValidExtension) {
            alert('Solo se permiten archivos PDF o Excel (.xlsx, .xls)');
            return;
        }

        setIsLoading(true);

        try {
            // Convert file to base64
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                    const result = reader.result as string;
                    // Remove data URL prefix to get just base64
                    const base64Data = result.split(',')[1];
                    resolve(base64Data);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const templateFile: TemplateFile = {
                name: file.name,
                type: extension === 'pdf' ? 'pdf' : 'excel',
                data: base64,
            };

            onTemplateChange(templateFile);
        } catch (error) {
            console.error('Error reading file:', error);
            alert('Error al leer el archivo');
        } finally {
            setIsLoading(false);
        }
    }, [onTemplateChange]);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            handleFile(file);
        }
    }, [handleFile]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFile(file);
        }
        // Reset input
        e.target.value = '';
    }, [handleFile]);

    // If template exists, show preview
    if (template) {
        return (
            <div className="rounded-xl border-2 border-success/50 bg-success/5 p-6 animate-fade-in">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-success/10">
                            {template.type === 'pdf' ? (
                                <FileText className="h-8 w-8 text-success" />
                            ) : (
                                <FileSpreadsheet className="h-8 w-8 text-success" />
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-success" />
                                <span className="font-semibold text-foreground">
                                    Plantilla Cargada
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                {template.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Tipo: {template.type === 'pdf' ? 'PDF' : 'Excel'}
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onTemplateClear}
                        className="text-destructive hover:bg-destructive/10"
                        title="Eliminar plantilla"
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        );
    }

    // Dropzone
    return (
        <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
                "rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-200",
                isDragging
                    ? "border-primary bg-primary/5 scale-[1.02]"
                    : "border-border hover:border-primary/50 hover:bg-secondary/30",
                isLoading && "opacity-50 pointer-events-none"
            )}
        >
            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls"
                onChange={handleInputChange}
                className="hidden"
            />

            <div className="flex flex-col items-center gap-4">
                <div className={cn(
                    "p-4 rounded-full transition-colors",
                    isDragging ? "bg-primary/20" : "bg-secondary"
                )}>
                    <Upload className={cn(
                        "h-8 w-8 transition-colors",
                        isDragging ? "text-primary" : "text-muted-foreground"
                    )} />
                </div>

                <div>
                    <p className="font-medium text-foreground">
                        {isLoading ? 'Cargando...' : 'Arrastra tu plantilla aquí'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                        o haz clic para seleccionar
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                        Soporta PDF o Excel (.xlsx, .xls)
                    </p>
                </div>
            </div>
        </div>
    );
}
