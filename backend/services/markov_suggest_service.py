"""
Markov Chain Predictive Suggestion Service.

Builds a lightweight bigram (word-level) transition model from existing
MasterProduct data to provide autocomplete suggestions as users type
in the search field.

The model is cached in memory with a TTL to avoid recomputation on every request.
"""
import time
import logging
from collections import defaultdict
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import select

from database.models import MasterProduct

logger = logging.getLogger(__name__)

# Cache TTL in seconds
CACHE_TTL = 300  # 5 minutes


class MarkovSuggestService:
    """
    In-memory Markov Chain for predictive product search suggestions.
    
    Builds word-level bigrams from product descriptions, codes, and brands.
    Given a partial input, it:
      1. Finds matching words that start with the last typed token
      2. Predicts likely next words using transition probabilities
      3. Returns ranked suggestion strings
    """

    def __init__(self):
        # Word frequency: how often each word appears
        self._word_freq: dict[str, int] = defaultdict(int)
        # Bigram transitions: word_a -> {word_b: count}
        self._transitions: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        # All unique words for prefix matching
        self._vocabulary: list[str] = []
        # Cache metadata
        self._last_built: float = 0
        self._product_count: int = 0

    @property
    def is_stale(self) -> bool:
        """Check if the model needs rebuilding."""
        return (time.time() - self._last_built) > CACHE_TTL

    def build_model(self, db: Session) -> None:
        """
        Build the bigram model from MasterProduct data.
        
        Only rebuilds if the cache has expired.
        """
        if not self.is_stale:
            return

        start = time.time()

        # Fetch all product text data efficiently
        query = select(
            MasterProduct.clean_code,
            MasterProduct.description,
            MasterProduct.brand,
        )
        rows = db.execute(query).all()

        # Reset model
        word_freq: dict[str, int] = defaultdict(int)
        transitions: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))

        for code, description, brand in rows:
            # Combine all text fields into one sequence
            parts = []
            if code:
                parts.append(code.upper().strip())
            if description:
                parts.append(description.upper().strip())
            if brand:
                parts.append(brand.upper().strip())

            text = " ".join(parts)
            tokens = text.split()

            # Count word frequencies
            for token in tokens:
                word_freq[token] += 1

            # Build bigram transitions
            for i in range(len(tokens) - 1):
                transitions[tokens[i]][tokens[i + 1]] += 1

        self._word_freq = word_freq
        self._transitions = transitions
        self._vocabulary = sorted(word_freq.keys())
        self._product_count = len(rows)
        self._last_built = time.time()

        elapsed = time.time() - start
        logger.info(
            "markov_model_built",
            extra={
                "product_count": len(rows),
                "vocabulary_size": len(self._vocabulary),
                "build_time_ms": round(elapsed * 1000, 1),
            }
        )

    def suggest(self, prefix: str, limit: int = 8) -> List[str]:
        """
        Generate suggestions for a given search prefix.
        
        Args:
            prefix: The text the user has typed so far
            limit: Max number of suggestions to return
            
        Returns:
            List of suggestion strings, ordered by relevance
        """
        if not prefix or not self._vocabulary:
            return []

        prefix_upper = prefix.upper().strip()
        tokens = prefix_upper.split()

        if not tokens:
            return []

        last_token = tokens[-1]
        preceding_tokens = tokens[:-1]

        suggestions: list[tuple[str, float]] = []

        # 1. Find words that start with the partial last token (prefix match)
        matching_words = self._prefix_match(last_token, limit=30)

        if not matching_words:
            return []

        # 2. Score each matching word
        for word, base_score in matching_words:
            score = base_score

            # Boost score if there's a bigram transition from the previous word
            if preceding_tokens:
                prev_word = preceding_tokens[-1]
                if prev_word in self._transitions:
                    trans = self._transitions[prev_word]
                    total = sum(trans.values())
                    if word in trans and total > 0:
                        # Bigram probability boost (0-1 range, weighted heavily)
                        bigram_prob = trans[word] / total
                        score += bigram_prob * 10

            # Build the full suggestion: preceding context + completed word + predicted next
            context = " ".join(preceding_tokens) if preceding_tokens else ""
            full_suggestion = f"{context} {word}".strip() if context else word

            # Add predicted next word(s) for richer suggestions
            next_words = self._predict_next(word, top_n=2)
            if next_words:
                extended = f"{full_suggestion} {next_words[0]}"
                suggestions.append((extended, score + 1))

            suggestions.append((full_suggestion, score))

        # Sort by score descending, deduplicate
        suggestions.sort(key=lambda x: x[1], reverse=True)

        seen = set()
        result = []
        for text, _ in suggestions:
            text_lower = text.lower()
            if text_lower not in seen:
                seen.add(text_lower)
                result.append(text)
                if len(result) >= limit:
                    break

        return result

    def _prefix_match(self, prefix: str, limit: int = 30) -> list[tuple[str, float]]:
        """
        Find words that start with the given prefix.
        Returns (word, score) tuples where score is based on word frequency.
        """
        matches = []
        for word in self._vocabulary:
            if word.startswith(prefix):
                # Score by word frequency (log-scaled to avoid extremes)
                freq = self._word_freq.get(word, 1)
                score = freq
                matches.append((word, score))
                if len(matches) >= limit:
                    break

        # Sort by frequency descending
        matches.sort(key=lambda x: x[1], reverse=True)
        return matches

    def _predict_next(self, word: str, top_n: int = 2) -> list[str]:
        """Predict the most likely next words after the given word."""
        if word not in self._transitions:
            return []

        trans = self._transitions[word]
        if not trans:
            return []

        # Sort by count descending
        sorted_next = sorted(trans.items(), key=lambda x: x[1], reverse=True)
        return [w for w, _ in sorted_next[:top_n]]

    def get_stats(self) -> dict:
        """Return model statistics for debugging."""
        return {
            "vocabulary_size": len(self._vocabulary),
            "product_count": self._product_count,
            "transition_pairs": sum(len(v) for v in self._transitions.values()),
            "cache_age_seconds": round(time.time() - self._last_built, 1) if self._last_built else None,
            "is_stale": self.is_stale,
        }


# Singleton instance
_service: Optional[MarkovSuggestService] = None


def get_markov_service() -> MarkovSuggestService:
    """Get or create the singleton MarkovSuggestService."""
    global _service
    if _service is None:
        _service = MarkovSuggestService()
    return _service
