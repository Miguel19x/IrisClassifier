/**
 * Export Settings Page
 * 
 * Advanced configuration for PDF/Excel exports with rich text headers and templates.
 */
import { useState } from 'react';
import {
    FileDown,
    FileSpreadsheet,
    Settings,
    FileText,
    RotateCcw,
    Save,
    ArrowLeft,
    Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useExportConfig } from '@/contexts/ExportConfigContext';
import { RichTextEditor } from '@/components/export/RichTextEditor';
import { TemplateDropzone } from '@/components/export/TemplateDropzone';
import './ExportSettings.css';

interface ExportSettingsPageProps {
    onBack: () => void;
}

export function ExportSettingsPage({ onBack }: ExportSettingsPageProps) {
    const {
        config,
        updateConfig,
        updateManualHeader,
        setTemplate,
        clearTemplate,
        resetToDefaults,
    } = useExportConfig();

    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        // Config is auto-saved to localStorage, but we show feedback
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleReset = () => {
        if (confirm('¿Restaurar todas las opciones de exportación a sus valores por defecto?')) {
            resetToDefaults();
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 pb-24 max-w-4xl">
            <div className="animate-slide-up">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onBack}
                        className="shrink-0"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="font-display text-3xl font-bold text-foreground">
                            Opciones de Exportación
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Configura el formato de tus reportes PDF y Excel
                        </p>
                    </div>
                </div>

                {/* General Configuration */}
                <Card variant="glass" className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5 text-primary" />
                            Configuración General
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-foreground mb-2 block">
                                Nombre del Archivo
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    value={config.filename}
                                    onChange={(e) => updateConfig({ filename: e.target.value })}
                                    placeholder="Nombre del archivo..."
                                    className="flex-1"
                                />
                                <div className="flex items-center px-3 rounded-md bg-secondary text-muted-foreground text-sm">
                                    .pdf / .xlsx
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                Vista previa: <code className="px-1 py-0.5 rounded bg-secondary">
                                    {config.filename.replace(/\s+/g, '_')}_{new Date().toISOString().split('T')[0]}.pdf
                                </code>
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Mode Selection */}
                <div className="grid gap-4 md:grid-cols-2 mb-6">
                    <button
                        onClick={() => updateConfig({ headerMode: 'manual' })}
                        className={cn(
                            "p-4 rounded-xl border-2 text-left transition-all duration-200",
                            config.headerMode === 'manual'
                                ? "border-primary bg-primary/5 shadow-glow"
                                : "border-border bg-card hover:border-primary/50"
                        )}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className={cn(
                                "p-2 rounded-lg",
                                config.headerMode === 'manual' ? "bg-primary/20" : "bg-secondary"
                            )}>
                                <FileText className={cn(
                                    "h-5 w-5",
                                    config.headerMode === 'manual' ? "text-primary" : "text-muted-foreground"
                                )} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground">Encabezado Manual</h3>
                                <p className="text-xs text-muted-foreground">Escribe tu propio título con formato</p>
                            </div>
                            {config.headerMode === 'manual' && (
                                <Badge variant="default" className="ml-auto">Activo</Badge>
                            )}
                        </div>
                    </button>

                    <button
                        onClick={() => updateConfig({ headerMode: 'template' })}
                        className={cn(
                            "p-4 rounded-xl border-2 text-left transition-all duration-200 relative",
                            config.headerMode === 'template'
                                ? "border-accent bg-accent/5 shadow-glow"
                                : "border-border bg-card hover:border-accent/50"
                        )}
                    >
                        {config.templateFile && (
                            <div className="absolute -top-2 -right-2">
                                <Badge variant="confirmed" className="gap-1">
                                    <Sparkles className="h-3 w-3" />
                                    Plantilla Lista
                                </Badge>
                            </div>
                        )}
                        <div className="flex items-center gap-3 mb-2">
                            <div className={cn(
                                "p-2 rounded-lg",
                                config.headerMode === 'template' ? "bg-accent/20" : "bg-secondary"
                            )}>
                                <FileSpreadsheet className={cn(
                                    "h-5 w-5",
                                    config.headerMode === 'template' ? "text-accent" : "text-muted-foreground"
                                )} />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground">Usar Plantilla</h3>
                                <p className="text-xs text-muted-foreground">Sube tu propio encabezado PDF/Excel</p>
                            </div>
                            {config.headerMode === 'template' && (
                                <Badge variant="pending" className="ml-auto">Activo</Badge>
                            )}
                        </div>
                    </button>
                </div>

                {/* Mode 1: Manual Header */}
                {config.headerMode === 'manual' && (
                    <Card variant="glass" className="mb-6 animate-fade-in">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                Encabezado Manual
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                Usa el editor para diseñar el título de tu reporte. Puedes aplicar formato de texto y alineación.
                            </p>
                            <RichTextEditor
                                content={config.manualHeader.content}
                                onChange={(html) => updateManualHeader({ content: html })}
                                placeholder="Escribe el título de tu reporte..."
                            />
                        </CardContent>
                    </Card>
                )}

                {/* Mode 2: Template Upload */}
                {config.headerMode === 'template' && (
                    <Card variant="glass" className="mb-6 animate-fade-in">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileSpreadsheet className="h-5 w-5 text-accent" />
                                Plantilla de Encabezado
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                Sube un archivo Excel o PDF que se usará como base. Los productos se insertarán debajo del contenido de tu plantilla.
                            </p>
                            <TemplateDropzone
                                template={config.templateFile}
                                onTemplateChange={setTemplate}
                                onTemplateClear={clearTemplate}
                            />
                        </CardContent>
                    </Card>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                        variant="premium"
                        size="lg"
                        className="flex-1 gap-2"
                        onClick={handleSave}
                    >
                        {saved ? (
                            <>
                                <Save className="h-5 w-5" />
                                ¡Guardado!
                            </>
                        ) : (
                            <>
                                <Save className="h-5 w-5" />
                                Guardar Configuración
                            </>
                        )}
                    </Button>
                    <Button
                        variant="outline"
                        size="lg"
                        className="gap-2"
                        onClick={handleReset}
                    >
                        <RotateCcw className="h-5 w-5" />
                        Restaurar
                    </Button>
                </div>

                {/* Info Box */}
                <div className="mt-8 p-4 rounded-xl bg-secondary/50 border border-border">
                    <h3 className="font-medium text-foreground mb-2 flex items-center gap-2">
                        <FileDown className="h-4 w-4 text-primary" />
                        ¿Cómo funciona?
                    </h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• <strong>Encabezado Manual:</strong> El título con formato se renderiza al inicio del documento</li>
                        <li>• <strong>Plantilla:</strong> Tu archivo se usa como base, los productos se insertan debajo</li>
                        <li>• La configuración se guarda automáticamente y persiste entre sesiones</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
