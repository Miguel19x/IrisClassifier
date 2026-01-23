/**
 * Export Preview Dialog
 * 
 * Shows a preview of the export data before downloading or printing.
 * 
 * ARCHITECTURE:
 * - Preview shows first 50 items of loaded products (for performance)
 * - "Imprimir" generates PDF via backend and opens in new tab for printing
 *   (ensures ALL products are included, not just virtualized ones)
 * - "Descargar" triggers the actual export via backend
 */
import { useState, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { FileText, FileSpreadsheet, Printer, X, Loader2, ExternalLink } from 'lucide-react';
import './ExportPreview.css';

interface MasterProduct {
    id: number;
    clean_code: string;
    description: string;
    brand: string | null;
    original_list_name: string;
    price_usd: number;
    margin_percentage: number | null;
    final_price: number | null;
}

interface ExportPreviewDialogProps {
    open: boolean;
    onClose: () => void;
    format: 'pdf' | 'excel';
    view: 'business' | 'client';
    products: MasterProduct[];
    totalProducts: number; // Total count from database, not just loaded
    headerContent: string;
    onExport: () => void;
    onPrint: () => Promise<void>; // Generates PDF and opens in new tab
}

// Number of items to show in preview mode
const PREVIEW_LIMIT = 50;

export function ExportPreviewDialog({
    open,
    onClose,
    format,
    view,
    products,
    totalProducts,
    headerContent,
    onExport,
    onPrint,
}: ExportPreviewDialogProps) {
    const [isPrinting, setIsPrinting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Only show first 50 products for preview performance
    const displayProducts = products.slice(0, PREVIEW_LIMIT);

    // Handle print action - generates PDF via backend and opens in new tab
    const handlePrint = useCallback(async () => {
        setIsPrinting(true);
        try {
            await onPrint();
            // Don't close dialog - user may want to also download
        } catch (error) {
            console.error('Error generating PDF for print:', error);
            alert('Error al generar PDF para imprimir');
        } finally {
            setIsPrinting(false);
        }
    }, [onPrint]);

    // Handle download action
    const handleDownload = useCallback(async () => {
        setIsExporting(true);
        try {
            await onExport();
            onClose();
        } catch (error) {
            console.error('Error exporting:', error);
            alert('Error al exportar');
        } finally {
            setIsExporting(false);
        }
    }, [onExport, onClose]);

    const isLoading = isPrinting || isExporting;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col export-preview-dialog">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Vista Previa de Exportación - {format.toUpperCase()}
                        <span className="text-sm font-normal text-muted-foreground">
                            ({totalProducts.toLocaleString()} productos totales)
                        </span>
                    </DialogTitle>
                </DialogHeader>

                {/* Preview Area */}
                <div className="flex-1 overflow-auto border rounded-lg p-6 bg-white dark:bg-gray-900 export-preview-content">
                    {/* Header */}
                    <div
                        className="text-center mb-6 pb-4 border-b export-header"
                        dangerouslySetInnerHTML={{ __html: headerContent }}
                    />

                    {/* Preview Table */}
                    <Table className="export-preview-table">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-center w-12">N°</TableHead>
                                <TableHead className="text-center w-24">Código</TableHead>
                                <TableHead className="text-left">Descripción</TableHead>
                                <TableHead className="text-center w-24">Marca</TableHead>
                                {view === 'business' && (
                                    <>
                                        <TableHead className="text-center w-28">Lista</TableHead>
                                        <TableHead className="text-center w-20">USD</TableHead>
                                        <TableHead className="text-center w-16">%</TableHead>
                                    </>
                                )}
                                <TableHead className="text-center w-20">
                                    {view === 'business' ? 'Final' : 'USD'}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayProducts.map((product, index) => (
                                <TableRow key={product.id}>
                                    <TableCell className="text-center font-mono text-xs">
                                        {index + 1}
                                    </TableCell>
                                    <TableCell className="text-center font-mono text-xs">
                                        {product.clean_code || '-'}
                                    </TableCell>
                                    <TableCell className="text-left text-xs truncate max-w-[300px]">
                                        {product.description || 'Sin descripción'}
                                    </TableCell>
                                    <TableCell className="text-center text-xs">
                                        {product.brand || '-'}
                                    </TableCell>
                                    {view === 'business' && (
                                        <>
                                            <TableCell className="text-center text-xs truncate max-w-[100px]">
                                                {product.original_list_name || '-'}
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-xs">
                                                ${Number(product.price_usd || 0).toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-center font-mono text-xs">
                                                {product.margin_percentage !== null
                                                    ? `${Number(product.margin_percentage).toFixed(2)}%`
                                                    : '-'}
                                            </TableCell>
                                        </>
                                    )}
                                    <TableCell className="text-center font-mono text-xs font-semibold">
                                        ${Number(product.final_price || product.price_usd || 0).toFixed(2)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>

                    {/* Info about preview vs actual export */}
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-center">
                        <p className="text-muted-foreground">
                            📋 Vista previa: <strong>{Math.min(displayProducts.length, PREVIEW_LIMIT)}</strong> de{' '}
                            <strong>{products.length.toLocaleString()}</strong> productos cargados
                        </p>
                        {totalProducts > products.length && (
                            <p className="text-primary font-medium mt-1">
                                ✅ Al imprimir o descargar se incluirán los{' '}
                                <strong>{totalProducts.toLocaleString()}</strong> productos totales de la base de datos.
                            </p>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <DialogFooter className="gap-2 flex-wrap">
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                        <X className="h-4 w-4 mr-2" />
                        Cancelar
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handlePrint}
                        disabled={isLoading}
                        title="Genera PDF con todos los productos y lo abre en nueva pestaña para imprimir"
                    >
                        {isPrinting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generando PDF...
                            </>
                        ) : (
                            <>
                                <Printer className="h-4 w-4 mr-2" />
                                Imprimir
                                <ExternalLink className="h-3 w-3 ml-1 opacity-50" />
                            </>
                        )}
                    </Button>
                    <Button onClick={handleDownload} disabled={isLoading}>
                        {isExporting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Exportando...
                            </>
                        ) : format === 'pdf' ? (
                            <>
                                <FileText className="h-4 w-4 mr-2" />
                                Descargar PDF
                            </>
                        ) : (
                            <>
                                <FileSpreadsheet className="h-4 w-4 mr-2" />
                                Descargar Excel
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
