/**
 * Página consolidada de Gestión de Listas de Precios.
 * 
 * Diseño premium con animaciones y glassmorphism.
 */
import { useState, useMemo, useCallback } from 'react';
import {
    FileText,
    Package,
    CheckCircle2,
    Clock,
    Upload,
    Camera,
    Image as ImageIcon,
    Trash2,
    Eye,
    Sparkles,
    X,
    ArrowRightLeft,
} from 'lucide-react';
import { useLists, useUploadList, useDeleteList, useCompareLists, useCreateMixedListing } from '../services/queries';
import { useCamera } from '../hooks/useCamera';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { StatsCard } from '@/components/ui/StatsCard';
import { cn } from '@/lib/utils';

interface ListsManagerProps {
    onSelectList: (id: number) => void;
}

export function ListsManagerPage({ onSelectList }: ListsManagerProps) {
    const { data, isLoading, error } = useLists();
    const uploadMutation = useUploadList();
    const deleteMutation = useDeleteList();
    const compareMutation = useCompareLists();
    const createMixedListingMutation = useCreateMixedListing();
    const { takePhoto, pickFromGallery } = useCamera();

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadMode, setUploadMode] = useState<'file' | 'camera'>('file');
    const [selectedForCompare, setSelectedForCompare] = useState<number[]>([]);
    const [comparisonResult, setComparisonResult] = useState<Record<string, unknown> | null>(null);
    const [useAI, setUseAI] = useState(true);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (selectedFile) {
            try {
                await uploadMutation.mutateAsync(selectedFile);
                setSelectedFile(null);
                const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
            } catch (err) {
                alert('Error al subir: ' + (err instanceof Error ? err.message : 'Error desconocido'));
            }
        }
    };

    const handleTakePhoto = async () => {
        try {
            const photoDataUrl = await takePhoto();
            if (photoDataUrl) {
                const response = await fetch(photoDataUrl);
                const blob = await response.blob();
                const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
                setSelectedFile(file);
                setUploadMode('camera');
            }
        } catch (err) {
            alert('Error al tomar foto: ' + (err instanceof Error ? err.message : 'Error desconocido'));
        }
    };

    const handlePickFromGallery = async () => {
        try {
            const photoDataUrl = await pickFromGallery();
            if (photoDataUrl) {
                const response = await fetch(photoDataUrl);
                const blob = await response.blob();
                const file = new File([blob], `gallery_${Date.now()}.jpg`, { type: 'image/jpeg' });
                setSelectedFile(file);
                setUploadMode('camera');
            }
        } catch (err) {
            alert('Error al seleccionar imagen: ' + (err instanceof Error ? err.message : 'Error desconocido'));
        }
    };

    const handleDeleteList = async (id: number, name: string) => {
        if (confirm(`¿Eliminar la lista "${name}"? Esta acción no se puede deshacer.`)) {
            try {
                await deleteMutation.mutateAsync(id);
            } catch {
                alert('Error al eliminar lista');
            }
        }
    };

    const toggleSelectForCompare = useCallback((id: number) => {
        setSelectedForCompare(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    }, []);

    const handleCompare = async () => {
        if (selectedForCompare.length < 2) {
            alert('Selecciona al menos 2 listas para comparar');
            return;
        }
        try {
            const result = await compareMutation.mutateAsync({
                list_ids: selectedForCompare,
                use_ai: useAI
            });
            setComparisonResult(result as Record<string, unknown>);
        } catch (err) {
            alert('Error al comparar: ' + (err instanceof Error ? err.message : 'Error'));
        }
    };

    const handleCreateMixedListing = async () => {
        const name = prompt('Nombre del listado mixto:');
        if (!name) return;

        try {
            await createMixedListingMutation.mutateAsync({
                name,
                list_ids: selectedForCompare,
                use_best_prices: true
            });
            alert('¡Listado mixto creado!');
        } catch (err) {
            alert('Error al crear listado: ' + (err instanceof Error ? err.message : 'Error'));
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
        return (bytes / 1048576).toFixed(1) + " MB";
    };

    const lists = (data?.lists || []) as { id: number; name: string; status?: string; product_count?: number; created_at: string }[];

    // Memoize computed stats to avoid recalculation on every render
    // IMPORTANT: This must be called before any early returns to satisfy Rules of Hooks
    const { totalLists, totalProducts, completedLists, processingLists } = useMemo(() => {
        const total = lists.length;
        let products = 0;
        let completed = 0;
        let processing = 0;
        for (const l of lists) {
            products += l.product_count || 0;
            if (l.status === 'completed') completed++;
            else if (l.status === 'processing') processing++;
        }
        return {
            totalLists: total,
            totalProducts: products,
            completedLists: completed,
            processingLists: processing
        };
    }, [lists]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-muted-foreground animate-pulse">Cargando listas...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-destructive">Error al cargar listas: {error.message}</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Stats Dashboard */}
            <div className="mb-8 animate-slide-down">
                <h1 className="font-display text-3xl font-bold text-foreground mb-6">
                    Panel de Control
                </h1>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatsCard
                        title="Total Listas"
                        value={totalLists}
                        icon={FileText}
                        variant="primary"
                        delay={0}
                    />
                    <StatsCard
                        title="Total Productos"
                        value={totalProducts}
                        icon={Package}
                        variant="accent"
                        delay={0.1}
                    />
                    <StatsCard
                        title="Completadas"
                        value={completedLists}
                        icon={CheckCircle2}
                        variant="success"
                        delay={0.2}
                    />
                    {processingLists > 0 && (
                        <StatsCard
                            title="En Proceso"
                            value={processingLists}
                            icon={Clock}
                            variant="warning"
                            delay={0.3}
                        />
                    )}
                </div>
            </div>

            {/* Upload Section */}
            <div className="mb-8 animate-slide-up animation-delay-200 animation-fill-both">
                <Card variant="glass">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="h-5 w-5 text-primary" />
                            Subir Catálogo
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* Tabs */}
                        <div className="flex gap-2 mb-6">
                            <Button
                                variant={uploadMode === 'file' ? 'default' : 'outline'}
                                onClick={() => setUploadMode('file')}
                                className="gap-2"
                            >
                                <FileText className="h-4 w-4" />
                                Subir Archivo
                            </Button>
                            <Button
                                variant={uploadMode === 'camera' ? 'default' : 'outline'}
                                onClick={() => setUploadMode('camera')}
                                className="gap-2"
                            >
                                <Camera className="h-4 w-4" />
                                Usar Cámara
                            </Button>
                        </div>

                        {uploadMode === 'file' ? (
                            <div className="space-y-4">
                                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors">
                                    <input
                                        type="file"
                                        accept=".pdf,.xlsx,.xls,.csv"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        id="file-upload"
                                    />
                                    <label htmlFor="file-upload" className="cursor-pointer">
                                        <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                        <p className="text-foreground font-medium mb-1">
                                            Arrastra un archivo o haz clic para seleccionar
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            PDF, Excel (.xlsx, .xls) o CSV
                                        </p>
                                    </label>
                                </div>

                                {selectedFile && (
                                    <div className="flex items-center justify-between p-4 rounded-lg bg-secondary animate-slide-up">
                                        <div className="flex items-center gap-3">
                                            <FileText className="h-8 w-8 text-primary" />
                                            <div>
                                                <p className="font-medium text-foreground">{selectedFile.name}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    {formatFileSize(selectedFile.size)}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setSelectedFile(null)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex gap-4">
                                <Button variant="outline" size="lg" className="flex-1 gap-2 py-8" onClick={handleTakePhoto}>
                                    <Camera className="h-6 w-6" />
                                    Tomar Foto
                                </Button>
                                <Button variant="outline" size="lg" className="flex-1 gap-2 py-8" onClick={handlePickFromGallery}>
                                    <ImageIcon className="h-6 w-6" />
                                    Desde Galería
                                </Button>
                            </div>
                        )}

                        <Button
                            variant="premium"
                            size="lg"
                            className="w-full mt-6 gap-2"
                            disabled={!selectedFile || uploadMutation.isPending}
                            onClick={handleUpload}
                        >
                            <Sparkles className="h-5 w-5" />
                            {uploadMutation.isPending ? 'Procesando con IA...' : 'Procesar con IA'}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Comparison Section */}
            {selectedForCompare.length >= 2 && (
                <div className="mb-8 animate-expand">
                    <Card variant="glow">
                        <CardContent className="p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <ArrowRightLeft className="h-6 w-6 text-primary" />
                                    <div>
                                        <h3 className="font-semibold text-foreground">
                                            Comparar {selectedForCompare.length} listas
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            Encuentra los mejores precios entre proveedores
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <Switch checked={useAI} onCheckedChange={setUseAI} />
                                        <span className="text-sm text-foreground">Usar IA para matching</span>
                                    </div>
                                    <Button
                                        variant="premium"
                                        className="gap-2"
                                        onClick={handleCompare}
                                        disabled={compareMutation.isPending}
                                    >
                                        <Sparkles className="h-4 w-4" />
                                        {compareMutation.isPending ? 'Comparando...' : 'Comparar Listas'}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Lists Grid */}
            <div className="animate-fade-in animation-delay-300 animation-fill-both">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="font-display text-2xl font-bold text-foreground">Mis Listas</h2>
                    <Badge variant="outline">{lists.length} listas</Badge>
                </div>

                {lists.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {lists.map((list) => (
                            <div
                                key={list.id}
                                className="animate-fade-in"
                            >
                                <Card
                                    variant="glass"
                                    className={cn(
                                        "hover:border-primary/30 transition-all duration-200 group cursor-pointer",
                                        selectedForCompare.includes(list.id) && "border-primary shadow-glow"
                                    )}
                                >
                                    <CardContent className="p-5">
                                        <div className="flex items-start gap-4">
                                            <Checkbox
                                                checked={selectedForCompare.includes(list.id)}
                                                onCheckedChange={() => toggleSelectForCompare(list.id)}
                                                className="mt-1"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                                        {list.name}
                                                    </h3>
                                                    <Badge variant={list.status === 'completed' ? 'completed' : 'processing'}>
                                                        {list.status === 'completed' ? 'Completada' : 'Procesando...'}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground mb-1">
                                                    {list.product_count ?? 0} productos
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {new Date(list.created_at).toLocaleDateString('es-ES', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric',
                                                    })}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 gap-2"
                                                disabled={list.status === 'processing'}
                                                onClick={() => onSelectList(list.id)}
                                            >
                                                <Eye className="h-4 w-4" />
                                                Ver Productos
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                className="text-destructive hover:bg-destructive/10"
                                                onClick={() => handleDeleteList(list.id, list.name)}
                                                disabled={deleteMutation.isPending}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Card variant="glass" className="p-12 text-center">
                        <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                        <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                            Aún no hay listas
                        </h3>
                        <p className="text-muted-foreground">
                            Sube un archivo o escanea con la cámara para empezar
                        </p>
                    </Card>
                )
                }
            </div>

            {/* Comparison Results Modal */}
            {comparisonResult && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in"
                    onClick={() => setComparisonResult(null)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-4xl max-h-[80vh] overflow-auto animate-scale-in"
                    >
                        <Card variant="glass">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Resultados de Comparación</CardTitle>
                                <Button variant="ghost" size="icon" onClick={() => setComparisonResult(null)}>
                                    <X className="h-5 w-5" />
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {/* Comparison Stats */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                                    <div className="text-center p-4 rounded-lg bg-success/10 border border-success/30">
                                        <p className="text-2xl sm:text-3xl font-bold text-success">
                                            {(comparisonResult.stats as { total_matches?: number })?.total_matches || 0}
                                        </p>
                                        <p className="text-xs sm:text-sm text-muted-foreground">Productos coincidentes</p>
                                    </div>
                                    <div className="text-center p-4 rounded-lg bg-primary/10 border border-primary/30">
                                        <p className="text-2xl sm:text-3xl font-bold text-primary">
                                            ${((comparisonResult.stats as { potential_savings?: number })?.potential_savings || 0).toFixed(2)}
                                        </p>
                                        <p className="text-xs sm:text-sm text-muted-foreground">Ahorro potencial</p>
                                    </div>
                                    <div className="text-center p-4 rounded-lg bg-warning/10 border border-warning/30">
                                        <p className="text-2xl sm:text-3xl font-bold text-warning">
                                            {(comparisonResult.stats as { unique_products?: number })?.unique_products || 0}
                                        </p>
                                        <p className="text-xs sm:text-sm text-muted-foreground">Productos únicos</p>
                                    </div>
                                </div>

                                {/* Comparison table */}
                                <div className="rounded-lg border border-border overflow-hidden mb-6">
                                    <table className="w-full">
                                        <thead className="bg-secondary">
                                            <tr>
                                                <th className="text-left p-3 text-sm font-medium text-foreground">Producto</th>
                                                {(comparisonResult.lists as { id: number; name: string }[] || []).map((list: { id: number; name: string }) => (
                                                    <th key={list.id} className="text-right p-3 text-sm font-medium text-foreground">{list.name}</th>
                                                ))}
                                                <th className="text-center p-3 text-sm font-medium text-foreground">Diferencia</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {(comparisonResult.matches as { canonical_name: string; products: { list_id: number; price: number; is_best_price: boolean }[]; price_range: number }[] || []).slice(0, 10).map((match: { canonical_name: string; products: { list_id: number; price: number; is_best_price: boolean }[]; price_range: number }, idx: number) => {
                                                const productsByList: Record<number, { price: number; is_best_price: boolean }> = {};
                                                match.products?.forEach((p: { list_id: number; price: number; is_best_price: boolean }) => {
                                                    productsByList[p.list_id] = p;
                                                });
                                                return (
                                                    <tr key={idx} className="hover:bg-secondary/50 transition-colors">
                                                        <td className="p-3 text-foreground">{match.canonical_name}</td>
                                                        {(comparisonResult.lists as { id: number }[] || []).map((list: { id: number }) => {
                                                            const product = productsByList[list.id];
                                                            const isBest = product?.is_best_price;
                                                            return (
                                                                <td key={list.id} className={cn("p-3 text-right", isBest && "text-success font-medium")}>
                                                                    {product ? `$${product.price?.toFixed(2) || '-'}` : '-'}
                                                                    {isBest && ' ✓'}
                                                                </td>
                                                            );
                                                        })}
                                                        <td className={cn("p-3 text-center", match.price_range > 0 && "text-warning")}>
                                                            {match.price_range ? `$${match.price_range.toFixed(2)}` : '-'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                <Button
                                    variant="premium"
                                    size="lg"
                                    className="w-full gap-2"
                                    onClick={handleCreateMixedListing}
                                    disabled={createMixedListingMutation.isPending}
                                >
                                    <Sparkles className="h-5 w-5" />
                                    {createMixedListingMutation.isPending ? 'Creando...' : 'Crear Listado con Mejores Precios'}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div >
    );
}
