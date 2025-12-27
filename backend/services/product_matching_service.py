"""
Product Matching Service.

Detects identical products across different catalogs for price comparison.
Uses multiple strategies: exact matching, fuzzy matching, and AI-powered matching.
"""
import logging
import re
import unicodedata
from typing import List, Dict, Optional, Tuple
from decimal import Decimal
import httpx
from rapidfuzz import fuzz
from sqlalchemy.orm import Session

from database.models import Product, ProductMatch, ProductMatchMember
from core.exceptions import IrisException

logger = logging.getLogger(__name__)


class ProductMatchingService:
    """
    Service for detecting and managing product matches across catalogs.
    
    Strategies:
    1. Exact matching: Normalized names match exactly
    2. Fuzzy matching: High similarity score (>= 85%)
    3. AI matching: Ollama groups similar products
    """
    
    def __init__(self, ollama_url: str = "http://localhost:11434"):
        """Initialize matching service."""
        self.ollama_url = ollama_url
        self.model = "llama3.2"
        self.fuzzy_threshold = 85  # Minimum similarity score for fuzzy match
    
    def normalize_name(self, name: str) -> str:
        """
        Normalize product name for matching.
        
        Steps:
        1. Convert to lowercase
        2. Remove accents/diacritics
        3. Remove special characters (keep alphanumeric and spaces)
        4. Normalize whitespace
        5. Remove common filler words
        
        Args:
            name: Original product name
            
        Returns:
            Normalized name
        """
        if not name:
            return ""
        
        # Lowercase
        normalized = name.lower()
        
        # Remove accents
        normalized = ''.join(
            c for c in unicodedata.normalize('NFD', normalized)
            if unicodedata.category(c) != 'Mn'
        )
        
        # Remove special characters (keep letters, numbers, spaces)
        normalized = re.sub(r'[^a-z0-9\s]', ' ', normalized)
        
        # Normalize whitespace
        normalized = ' '.join(normalized.split())
        
        # Remove common filler words
        filler_words = {'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas', 'the', 'a', 'an'}
        words = normalized.split()
        words = [w for w in words if w not in filler_words]
        normalized = ' '.join(words)
        
        return normalized.strip()
    
    async def find_matches(
        self,
        db: Session,
        catalog_ids: List[int],
        user_id: int,
        use_ai: bool = True
    ) -> List[ProductMatch]:
        """
        Find product matches across specified catalogs.
        
        Args:
            db: Database session
            catalog_ids: List of catalog IDs to compare
            user_id: User ID for ownership
            use_ai: Whether to use AI matching (slower but more accurate)
            
        Returns:
            List of ProductMatch objects
        """
        logger.info(
            "finding_product_matches",
            extra={
                "catalog_ids": catalog_ids,
                "user_id": user_id,
                "use_ai": use_ai
            }
        )
        
        # Get all products from specified catalogs
        products = db.query(Product).filter(
            Product.catalog_id.in_(catalog_ids)
        ).all()
        
        if not products:
            return []
        
        # Group products by normalized name for exact matching
        exact_matches = self._find_exact_matches(products, db, user_id)
        
        # Find fuzzy matches for remaining products
        matched_product_ids = set()
        for match in exact_matches:
            matched_product_ids.update([m.product_id for m in match.members])
        
        unmatched_products = [p for p in products if p.id not in matched_product_ids]
        fuzzy_matches = self._find_fuzzy_matches(unmatched_products, db, user_id)
        
        all_matches = exact_matches + fuzzy_matches
        
        # Optionally use AI for remaining unmatched products
        if use_ai:
            matched_product_ids.update([
                m.product_id 
                for match in fuzzy_matches 
                for m in match.members
            ])
            still_unmatched = [p for p in products if p.id not in matched_product_ids]
            
            if still_unmatched:
                ai_matches = await self._find_ai_matches(still_unmatched, db, user_id)
                all_matches.extend(ai_matches)
        
        logger.info(
            "product_matches_found",
            extra={
                "total_matches": len(all_matches),
                "exact": len(exact_matches),
                "fuzzy": len(fuzzy_matches)
            }
        )
        
        return all_matches
    
    def _find_exact_matches(
        self,
        products: List[Product],
        db: Session,
        user_id: int
    ) -> List[ProductMatch]:
        """Find products with exactly matching normalized names."""
        matches = []
        grouped: Dict[str, List[Product]] = {}
        
        # Group by normalized name
        for product in products:
            normalized = self.normalize_name(product.name)
            if not normalized:
                continue
            
            if normalized not in grouped:
                grouped[normalized] = []
            grouped[normalized].append(product)
        
        # Create matches for groups with 2+ products
        for normalized_name, group_products in grouped.items():
            if len(group_products) < 2:
                continue
            
            # Check if products are from different catalogs
            catalog_ids = set(p.catalog_id for p in group_products)
            if len(catalog_ids) < 2:
                continue  # Same catalog, not a match
            
            # Create match
            match = ProductMatch(
                user_id=user_id,
                canonical_name=normalized_name,
                match_method="exact",
                confidence=1.0
            )
            db.add(match)
            db.flush()  # Get ID
            
            # Find best price
            best_price = None
            best_product_id = None
            for product in group_products:
                if product.price is not None:
                    if best_price is None or product.price < best_price:
                        best_price = product.price
                        best_product_id = product.id
            
            # Add members
            for product in group_products:
                member = ProductMatchMember(
                    match_id=match.id,
                    product_id=product.id,
                    is_best_price=(product.id == best_product_id)
                )
                db.add(member)
            
            matches.append(match)
        
        db.commit()
        return matches
    
    def _find_fuzzy_matches(
        self,
        products: List[Product],
        db: Session,
        user_id: int
    ) -> List[ProductMatch]:
        """Find products with similar names using fuzzy matching."""
        matches = []
        matched_ids = set()
        
        for i, product_a in enumerate(products):
            if product_a.id in matched_ids:
                continue
            
            group = [product_a]
            name_a = self.normalize_name(product_a.name)
            
            if not name_a:
                continue
            
            # Compare with remaining products
            for product_b in products[i+1:]:
                if product_b.id in matched_ids:
                    continue
                
                if product_a.catalog_id == product_b.catalog_id:
                    continue  # Same catalog
                
                name_b = self.normalize_name(product_b.name)
                if not name_b:
                    continue
                
                # Calculate similarity
                similarity = fuzz.ratio(name_a, name_b)
                
                if similarity >= self.fuzzy_threshold:
                    group.append(product_b)
                    matched_ids.add(product_b.id)
            
            # Create match if we have 2+ products from different catalogs
            if len(group) >= 2:
                catalog_ids = set(p.catalog_id for p in group)
                if len(catalog_ids) >= 2:
                    # Use first product's normalized name as canonical
                    match = ProductMatch(
                        user_id=user_id,
                        canonical_name=name_a,
                        match_method="fuzzy",
                        confidence=0.85
                    )
                    db.add(match)
                    db.flush()
                    
                    # Find best price
                    best_price = None
                    best_product_id = None
                    for product in group:
                        if product.price is not None:
                            if best_price is None or product.price < best_price:
                                best_price = product.price
                                best_product_id = product.id
                    
                    # Add members
                    for product in group:
                        member = ProductMatchMember(
                            match_id=match.id,
                            product_id=product.id,
                            is_best_price=(product.id == best_product_id)
                        )
                        db.add(member)
                    
                    matches.append(match)
                    matched_ids.add(product_a.id)
        
        db.commit()
        return matches
    
    async def _find_ai_matches(
        self,
        products: List[Product],
        db: Session,
        user_id: int
    ) -> List[ProductMatch]:
        """Use Ollama AI to find similar products."""
        if not products:
            return []
        
        # Build prompt
        product_list = "\n".join([
            f"{i+1}. {p.name} (ID: {p.id}, Catalog: {p.catalog_id})"
            for i, p in enumerate(products)
        ])
        
        prompt = f"""You are a product matching expert. Given this list of products from different catalogs, identify groups of products that are the same item.

Products:
{product_list}

Respond with ONLY a JSON array of groups. Each group should list the product IDs that match. Only include groups with 2+ products from different catalogs.

Example format:
[
  {{"ids": [1, 5, 12], "name": "wireless mouse"}},
  {{"ids": [3, 8], "name": "mechanical keyboard"}}
]

JSON:"""
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {"temperature": 0.1}
                    }
                )
                
                if response.status_code != 200:
                    logger.warning(f"Ollama returned status {response.status_code}")
                    return []
                
                result = response.json()
                ai_response = result.get("response", "")
                
                # Parse JSON
                import json
                ai_response = ai_response.strip()
                if ai_response.startswith("```"):
                    ai_response = ai_response.split("```")[1]
                    if ai_response.startswith("json"):
                        ai_response = ai_response[4:]
                
                groups = json.loads(ai_response)
                
                # Create matches
                matches = []
                product_map = {p.id: p for p in products}
                
                for group in groups:
                    product_ids = group.get("ids", [])
                    canonical_name = group.get("name", "")
                    
                    if len(product_ids) < 2:
                        continue
                    
                    group_products = [product_map[pid] for pid in product_ids if pid in product_map]
                    
                    if len(group_products) < 2:
                        continue
                    
                    # Check different catalogs
                    catalog_ids = set(p.catalog_id for p in group_products)
                    if len(catalog_ids) < 2:
                        continue
                    
                    match = ProductMatch(
                        user_id=user_id,
                        canonical_name=canonical_name or self.normalize_name(group_products[0].name),
                        match_method="ai",
                        confidence=0.90
                    )
                    db.add(match)
                    db.flush()
                    
                    # Find best price
                    best_price = None
                    best_product_id = None
                    for product in group_products:
                        if product.price is not None:
                            if best_price is None or product.price < best_price:
                                best_price = product.price
                                best_product_id = product.id
                    
                    # Add members
                    for product in group_products:
                        member = ProductMatchMember(
                            match_id=match.id,
                            product_id=product.id,
                            is_best_price=(product.id == best_product_id)
                        )
                        db.add(member)
                    
                    matches.append(match)
                
                db.commit()
                return matches
                
        except Exception as e:
            logger.warning(f"AI matching failed: {e}")
            return []
