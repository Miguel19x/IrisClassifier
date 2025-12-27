"""
Brand Detection Service for Automotive Catalogs.

Detects vehicle manufacturer brands from catalog images using:
1. Visual section detection (color bands, logo positions)
2. AI-powered correlation using Ollama LLM
3. Pattern matching fallback for known model names
"""
import logging
import re
import httpx
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from PIL import Image
import io

logger = logging.getLogger(__name__)


@dataclass
class BrandSection:
    """Represents a detected brand section in a catalog."""
    brand_name: str
    confidence: float
    start_row: int  # First row index of this brand's products
    end_row: int    # Last row index (exclusive)
    detection_method: str  # "logo_ocr", "ai_inference", "pattern_match"


@dataclass
class RowWithBrand:
    """A catalog row with its detected brand."""
    row_data: Dict[str, str]
    brand: Optional[str]
    brand_confidence: float


class BrandDetectionService:
    """
    Intelligent brand detection for automotive catalogs.
    
    Uses a multi-strategy approach:
    1. Visual detection of section headers (logos, colored bands)
    2. AI inference using Ollama to correlate models with brands
    3. Pattern matching as fallback
    """
    
    def __init__(self, ollama_url: str = "http://localhost:11434"):
        """
        Initialize brand detection service.
        
        Args:
            ollama_url: URL of Ollama API server
        """
        self.ollama_url = ollama_url
        self.model = "llama3.2"  # Default model
        
        # Known automotive brands and their common model patterns
        self.brand_patterns = {
            "Alfa Romeo": [r"^1\d{2}$", r"^SPIDER", r"^GIULIA", r"^STELVIO"],
            "Audi": [r"^A[1-8]", r"^Q[2-8]", r"^TT", r"^R8", r"^RS", r"^S[1-8]"],
            "BMW": [r"^\d{3}[id]?$", r"^X[1-7]", r"^Z[1-4]", r"^M[1-8]?"],
            "Chevrolet": [r"^CORVETTE", r"^CAMARO", r"^SILVERADO", r"^TAHOE", r"^SPARK", r"^CRUZE"],
            "Fiat": [r"^5\d{2}$", r"^PUNTO", r"^PANDA", r"^TIPO", r"^DUCATO"],
            "Ford": [r"^FIESTA", r"^FOCUS", r"^MUSTANG", r"^F-?\d{3}", r"^RANGER", r"^ESCAPE"],
            "Honda": [r"^CIVIC", r"^ACCORD", r"^CR-?V", r"^FIT", r"^PILOT", r"^ODYSSEY"],
            "Hyundai": [r"^ELANTRA", r"^SONATA", r"^TUCSON", r"^SANTA", r"^ACCENT", r"^KONA"],
            "Kia": [r"^SPORTAGE", r"^SORENTO", r"^OPTIMA", r"^RIO", r"^FORTE", r"^SOUL"],
            "Mazda": [r"^MAZDA\s?[2-6]", r"^MX-?[5]", r"^CX-?[3-9]", r"^3$", r"^6$"],
            "Mercedes-Benz": [r"^[ABCES]-?\d{3}", r"^CL[AKS]", r"^GL[ABCES]?", r"^SL[KR]?"],
            "Mitsubishi": [r"^LANCER", r"^OUTLANDER", r"^ECLIPSE", r"^MONTERO", r"^PAJERO"],
            "Nissan": [r"^SENTRA", r"^ALTIMA", r"^MAXIMA", r"^PATHFINDER", r"^FRONTIER", r"^350Z", r"^370Z"],
            "Peugeot": [r"^[1-5]\d{2}$", r"^RCZ", r"^PARTNER", r"^BOXER"],
            "Renault": [r"^CLIO", r"^MEGANE", r"^SCENIC", r"^DUSTER", r"^SANDERO", r"^LOGAN"],
            "Subaru": [r"^IMPREZA", r"^OUTBACK", r"^FORESTER", r"^WRX", r"^BRZ", r"^LEGACY"],
            "Suzuki": [r"^SWIFT", r"^VITARA", r"^JIMNY", r"^SX4", r"^ALTO"],
            "Toyota": [r"^COROLLA", r"^CAMRY", r"^RAV4", r"^HILUX", r"^LAND\s?CRUISER", r"^PRIUS", r"^YARIS"],
            "Volkswagen": [r"^GOLF", r"^JETTA", r"^PASSAT", r"^TIGUAN", r"^BEETLE", r"^POLO", r"^VENTO"],
            "Volvo": [r"^S[46]0", r"^V[46]0", r"^XC[469]0", r"^C[37]0"],
        }
    
    async def detect_brands_in_rows(
        self,
        rows: List[Dict[str, str]],
        model_column: str = None
    ) -> List[RowWithBrand]:
        """
        Detect brands for each row in a catalog.
        
        Args:
            rows: List of row dictionaries with column data
            model_column: Name of the column containing model names
            
        Returns:
            List of rows with detected brand information
        """
        if not rows:
            return []
        
        # Find model column if not specified
        if not model_column:
            model_column = self._find_model_column(rows[0].keys())
        
        if not model_column:
            logger.warning("Could not determine model column")
            return [RowWithBrand(row_data=row, brand=None, brand_confidence=0.0) for row in rows]
        
        # Extract all model names
        model_names = [row.get(model_column, "") for row in rows]
        
        # Try AI inference first
        ai_brands = await self._detect_brands_with_ai(model_names)
        
        # Fall back to pattern matching for unknown brands
        results = []
        for i, row in enumerate(rows):
            model_name = model_names[i]
            
            # Check AI result first
            if ai_brands and ai_brands.get(model_name):
                brand = ai_brands[model_name]
                confidence = 0.9
                method = "ai_inference"
            else:
                # Try pattern matching
                brand, confidence = self._detect_brand_by_pattern(model_name)
                method = "pattern_match" if brand else "unknown"
            
            row_with_brand = row.copy()
            row_with_brand["_detected_brand"] = brand or "Unknown"
            row_with_brand["_brand_confidence"] = confidence
            row_with_brand["_detection_method"] = method
            
            results.append(RowWithBrand(
                row_data=row_with_brand,
                brand=brand,
                brand_confidence=confidence
            ))
        
        return results
    
    async def _detect_brands_with_ai(
        self, 
        model_names: List[str]
    ) -> Optional[Dict[str, str]]:
        """
        Use Ollama LLM to detect brands from model names.
        
        Args:
            model_names: List of vehicle model names
            
        Returns:
            Dict mapping model names to brand names, or None if AI unavailable
        """
        if not model_names:
            return None
        
        # Remove duplicates for efficient API call
        unique_models = list(set(m for m in model_names if m.strip()))
        
        if not unique_models:
            return None
        
        # Build prompt for AI
        prompt = f"""You are an automotive expert. Given these vehicle model names, identify the manufacturer (brand) for each.

Model names:
{chr(10).join(f'- {m}' for m in unique_models[:50])}

Respond ONLY with a JSON object mapping each model to its brand. Example:
{{"A4": "Audi", "318i": "BMW", "Civic": "Honda"}}

If you're unsure about a model, use "Unknown".
Respond with ONLY the JSON, no explanation."""

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": 0.1,  # Low temperature for consistent answers
                        }
                    }
                )
                
                if response.status_code != 200:
                    logger.warning(f"Ollama returned status {response.status_code}")
                    return None
                
                result = response.json()
                ai_response = result.get("response", "")
                
                # Parse JSON from response
                import json
                # Clean up response - sometimes AI adds markdown code blocks
                ai_response = ai_response.strip()
                if ai_response.startswith("```"):
                    ai_response = ai_response.split("```")[1]
                    if ai_response.startswith("json"):
                        ai_response = ai_response[4:]
                
                brand_map = json.loads(ai_response)
                
                logger.info(
                    "ai_brand_detection_success",
                    extra={
                        "models_detected": len(brand_map),
                        "total_models": len(unique_models)
                    }
                )
                
                return brand_map
                
        except httpx.TimeoutException:
            logger.warning("Ollama request timed out, falling back to patterns")
            return None
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse AI response as JSON: {e}")
            return None
        except Exception as e:
            logger.warning(f"AI brand detection failed: {e}")
            return None
    
    def _detect_brand_by_pattern(self, model_name: str) -> Tuple[Optional[str], float]:
        """
        Detect brand using regex patterns.
        
        Args:
            model_name: Vehicle model name
            
        Returns:
            Tuple of (brand_name, confidence)
        """
        if not model_name:
            return None, 0.0
        
        model_upper = model_name.upper().strip()
        
        for brand, patterns in self.brand_patterns.items():
            for pattern in patterns:
                if re.match(pattern, model_upper, re.IGNORECASE):
                    return brand, 0.7
        
        return None, 0.0
    
    def _find_model_column(self, columns) -> Optional[str]:
        """Find the column most likely containing model names."""
        model_keywords = ['modelo', 'model', 'marca modelo', 'marca', 'vehiculo', 'vehicle']
        
        for col in columns:
            col_lower = str(col).lower()
            for keyword in model_keywords:
                if keyword in col_lower:
                    return col
        
        # Default to first column if no keyword match
        columns_list = list(columns)
        return columns_list[0] if columns_list else None
    
    def detect_section_separators(
        self,
        image: Image.Image,
        threshold: int = 200
    ) -> List[int]:
        """
        Detect horizontal section separators in catalog image.
        
        Looks for rows with significantly different background color
        (like the yellow Audi/BMW headers in the example).
        
        Args:
            image: PIL Image
            threshold: Color difference threshold
            
        Returns:
            List of Y coordinates where section headers are detected
        """
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        width, height = image.size
        separators = []
        
        # Analyze horizontal strips
        strip_height = 10
        
        for y in range(0, height - strip_height, strip_height):
            # Get average color of this strip
            strip = image.crop((0, y, width, y + strip_height))
            colors = list(strip.getdata())
            
            if colors:
                avg_r = sum(c[0] for c in colors) / len(colors)
                avg_g = sum(c[1] for c in colors) / len(colors)
                avg_b = sum(c[2] for c in colors) / len(colors)
                
                # Check if this is a colored header (yellow, blue, etc - not white/gray)
                is_colored = (
                    abs(avg_r - avg_g) > 30 or  # Significant color difference
                    abs(avg_g - avg_b) > 30 or
                    avg_r + avg_g + avg_b < 600  # Not too bright (white)
                )
                
                is_saturated = max(avg_r, avg_g, avg_b) - min(avg_r, avg_g, avg_b) > 50
                
                if is_colored or is_saturated:
                    separators.append(y)
        
        # Merge nearby separators
        merged = []
        for sep in separators:
            if not merged or sep - merged[-1] > 20:
                merged.append(sep)
        
        logger.info(
            "section_separators_detected",
            extra={"count": len(merged), "positions": merged[:10]}
        )
        
        return merged
