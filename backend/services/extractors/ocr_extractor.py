"""
OCR Service using Tesseract.

Enhanced extractor for automotive catalogs with:
- Table structure detection using Tesseract TSV output
- Brand detection using AI and pattern matching
- Section separator detection for multi-brand catalogs
"""
import logging
import asyncio
from typing import List, Dict, Optional, Tuple
from PIL import Image
import pytesseract
import io
import re
import pandas as pd

from services.extractors.base import BaseExtractor, RawProduct
from services.list_schema_detector import ListSchemaDetector, ListType
from core.exceptions import FileProcessingError

logger = logging.getLogger(__name__)


class OCRExtractor(BaseExtractor):
    """
    Enhanced OCR-based extractor for images.
    
    Uses Tesseract OCR with table detection for structured catalogs.
    Integrates with BrandDetectionService for automotive catalogs.
    """
    
    def __init__(self):
        """Initialize OCR extractor."""
        super().__init__()
        # Configure Tesseract (update path if needed on Windows)
        # pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
    
    def supports(self, mime_type: str) -> bool:
        """
        Check if this extractor supports the given MIME type.
        
        Args:
            mime_type: MIME type to check
            
        Returns:
            True if supported, False otherwise
        """
        supported_types = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/bmp',
            'image/tiff',
        ]
        return mime_type in supported_types
    
    async def extract(self, file_content: bytes) -> List[RawProduct]:
        """
        Extract products from image using OCR.
        
        Attempts table detection first, falls back to line-by-line parsing.
        
        Args:
            file_content: Image file content
            
        Returns:
            List of extracted products
        """
        try:
            # Open image
            image = Image.open(io.BytesIO(file_content))
            original_image = image.copy()  # Keep original for section detection
            
            # Preprocess image
            image = self._preprocess_image(image)
            
            # Try to extract as table first (more structured)
            products = await self._extract_as_table(image, original_image)
            
            if products:
                logger.info(f"OCR table extraction found {len(products)} products")
                return products
            
            # Fallback to line-by-line parsing
            text = pytesseract.image_to_string(image, lang='eng+spa')
            logger.info(f"OCR extracted {len(text)} characters")
            
            products = self._parse_text(text)
            logger.info(f"OCR line parsing found {len(products)} products")
            
            return products
            
        except Exception as e:
            logger.error(f"OCR extraction failed: {e}", exc_info=True)
            raise FileProcessingError(f"Failed to process image: {str(e)}")
    
    async def _extract_as_table(
        self, 
        image: Image.Image,
        original_image: Image.Image
    ) -> List[RawProduct]:
        """
        Extract data as a structured table using Tesseract TSV output.
        
        Args:
            image: Preprocessed image
            original_image: Original image for section detection
            
        Returns:
            List of products if table detected, empty list otherwise
        """
        try:
            # Get TSV output with cell positions
            tsv_data = pytesseract.image_to_data(
                image, 
                lang='eng+spa', 
                output_type=pytesseract.Output.DATAFRAME
            )
            
            if tsv_data.empty:
                return []
            
            # Filter out empty text
            tsv_data = tsv_data[tsv_data['text'].notna() & (tsv_data['text'].str.strip() != '')]
            
            if len(tsv_data) < 5:  # Not enough data for a table
                return []
            
            # Group by line (block_num, par_num, line_num)
            lines = self._group_into_lines(tsv_data)
            
            if len(lines) < 3:  # Need at least header + 2 rows
                return []
            
            # Detect table structure
            table_data = self._detect_table_structure(lines)
            
            if not table_data or len(table_data) < 2:
                return []
            
            # First row is likely header
            headers = table_data[0]
            rows = table_data[1:]
            
            # Detect schema
            detector = ListSchemaDetector()
            schema = detector.detect(headers, rows[:5])
            
            logger.info(
                "ocr_table_schema_detected",
                extra={
                    "schema_type": schema.schema_type,
                    "confidence": schema.confidence,
                    "headers": headers[:5]
                }
            )
            
            # Extract products with brand detection for automotive catalogs
            if schema.schema_type == ListType.AUTOMOTIVE_PARTS:
                return await self._extract_automotive_with_brands(headers, rows, schema, original_image)
            else:
                return self._extract_price_list(headers, rows, schema)
            
        except Exception as e:
            logger.warning(f"Table extraction failed, falling back: {e}")
            return []
    
    def _group_into_lines(self, tsv_data: pd.DataFrame) -> List[List[Tuple[str, int, int]]]:
        """Group OCR data into lines with positions."""
        lines = []
        current_line = []
        prev_line_key = None
        
        for _, row in tsv_data.iterrows():
            line_key = (row['block_num'], row['par_num'], row['line_num'])
            
            if prev_line_key is not None and line_key != prev_line_key:
                if current_line:
                    lines.append(current_line)
                current_line = []
            
            current_line.append((
                str(row['text']).strip(),
                int(row['left']),
                int(row['top'])
            ))
            prev_line_key = line_key
        
        if current_line:
            lines.append(current_line)
        
        return lines
    
    def _detect_table_structure(
        self, 
        lines: List[List[Tuple[str, int, int]]]
    ) -> List[List[str]]:
        """
        Detect table columns from OCR lines based on X positions.
        
        Args:
            lines: List of lines, each being a list of (text, x, y) tuples
            
        Returns:
            List of rows, each being a list of column values
        """
        if not lines:
            return []
        
        # Detect column boundaries from first few lines
        all_x_positions = []
        for line in lines[:10]:
            for text, x, y in line:
                all_x_positions.append(x)
        
        if not all_x_positions:
            return []
        
        # Cluster X positions to find column boundaries
        all_x_positions.sort()
        column_breaks = [0]
        
        prev_x = all_x_positions[0]
        for x in all_x_positions[1:]:
            if x - prev_x > 50:  # Gap indicates new column
                column_breaks.append((prev_x + x) // 2)
            prev_x = x
        column_breaks.append(10000)  # End boundary
        
        # Assign cells to columns
        table_data = []
        
        for line in lines:
            row = [''] * (len(column_breaks) - 1)
            
            for text, x, y in line:
                # Find which column this belongs to
                for i in range(len(column_breaks) - 1):
                    if column_breaks[i] <= x < column_breaks[i + 1]:
                        if row[i]:
                            row[i] += ' ' + text
                        else:
                            row[i] = text
                        break
            
            # Only add non-empty rows
            if any(cell.strip() for cell in row):
                table_data.append([cell.strip() for cell in row])
        
        return table_data
    
    async def _extract_automotive_with_brands(
        self,
        headers: List[str],
        rows: List[List[str]],
        schema,
        original_image: Image.Image
    ) -> List[RawProduct]:
        """
        Extract automotive catalog with brand detection.
        
        Uses AI to correlate model names with manufacturer brands.
        """
        from services.brand_detection_service import BrandDetectionService
        
        products = []
        brand_service = BrandDetectionService()
        
        # Find model column
        model_col_idx = 0
        for i, header in enumerate(headers):
            header_lower = header.lower()
            if any(kw in header_lower for kw in ['modelo', 'model', 'marca']):
                model_col_idx = i
                break
        
        # Build row dictionaries
        row_dicts = []
        for row in rows:
            if len(row) > model_col_idx:
                row_dict = {
                    headers[i]: row[i] if i < len(row) else ''
                    for i in range(len(headers))
                }
                row_dicts.append(row_dict)
        
        # Detect brands using AI + pattern matching
        rows_with_brands = await brand_service.detect_brands_in_rows(
            row_dicts,
            model_column=headers[model_col_idx] if model_col_idx < len(headers) else None
        )
        
        # Create products
        for row_with_brand in rows_with_brands:
            columns = row_with_brand.row_data.copy()
            
            # Add detected brand
            brand = row_with_brand.brand or "Unknown"
            columns["_manufacturer"] = brand
            
            # Build name
            model_name = columns.get(headers[model_col_idx], "") if model_col_idx < len(headers) else ""
            name_parts = [brand, model_name]
            
            # Add year and engine if available
            for key, value in columns.items():
                key_lower = key.lower()
                if any(kw in key_lower for kw in ['año', 'year']) and value:
                    name_parts.append(value)
                    break
            
            name = " | ".join(filter(None, name_parts))
            
            products.append(RawProduct(
                name=name,
                price_text="",
                raw_line=str(columns),
                columns=columns,
                catalog_type="automotive_parts"
            ))
        
        return products
    
    def _extract_price_list(
        self,
        headers: List[str],
        rows: List[List[str]],
        schema
    ) -> List[RawProduct]:
        """Extract traditional price list from table."""
        products = []
        
        # Find name and price columns
        name_col = 0
        price_col = 1
        
        for i, header in enumerate(headers):
            header_lower = header.lower()
            if any(kw in header_lower for kw in ['nombre', 'producto', 'name', 'item']):
                name_col = i
            if any(kw in header_lower for kw in ['precio', 'price', 'valor', 'costo']):
                price_col = i
        
        for row in rows:
            if len(row) <= max(name_col, price_col):
                continue
            
            name = row[name_col].strip()
            price_text = row[price_col].strip()
            
            if name and len(name) > 1:
                columns = {
                    headers[i]: row[i] if i < len(row) else ''
                    for i in range(len(headers))
                }
                
                products.append(RawProduct(
                    name=name,
                    price_text=price_text,
                    raw_line=str(row),
                    columns=columns,
                    catalog_type="price_list"
                ))
        
        return products
    
    def _preprocess_image(self, image: Image.Image) -> Image.Image:
        """
        Preprocess image for better OCR results.
        
        Args:
            image: PIL Image
            
        Returns:
            Preprocessed image
        """
        # Convert to grayscale
        image = image.convert('L')
        
        # Resize if too small
        width, height = image.size
        if width < 1200:
            scale = 1200 / width
            new_size = (int(width * scale), int(height * scale))
            image = image.resize(new_size, Image.Resampling.LANCZOS)
        
        # Increase contrast
        from PIL import ImageEnhance
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.5)
        
        # Sharpen
        enhancer = ImageEnhance.Sharpness(image)
        image = enhancer.enhance(2.0)
        
        return image
    
    def _parse_text(self, text: str) -> List[RawProduct]:
        """
        Parse products from OCR text (fallback for non-table images).
        
        Args:
            text: OCR extracted text
            
        Returns:
            List of raw products
        """
        products = []
        lines = text.split('\n')
        
        # Price patterns
        price_patterns = [
            r'\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',  # $1,234.56
            r'(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:USD|usd|\$)',  # 1,234.56 USD
            r'(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*€',  # 1.234,56€
        ]
        
        for line in lines:
            line = line.strip()
            if not line or len(line) < 3:
                continue
            
            # Try to find price in line
            price_text = None
            for pattern in price_patterns:
                match = re.search(pattern, line)
                if match:
                    price_text = match.group(0)
                    break
            
            if price_text:
                # Extract product name (text before price)
                name_match = re.match(r'^(.+?)(?=\$|\d+[,.]?\d*\s*(?:USD|€))', line)
                if name_match:
                    name = name_match.group(1).strip()
                    if name and len(name) > 2:
                        products.append(RawProduct(
                            name=name,
                            price_text=price_text,
                            raw_line=line,
                            catalog_type="price_list"
                        ))
        
        return products
