import logging
import re
from abc import ABC, abstractmethod
from typing import Dict, Optional

logger = logging.getLogger(__name__)

class BasePreprocessor(ABC):
    def __init__(self, language_code: str):
        self.language_code = language_code

    @abstractmethod
    def process(self, text: str, dictionary: Dict[str, str]) -> str:
        """Process text using language-specific logic and apply the phonetic dictionary."""
        pass

    def apply_dictionary(self, text: str, dictionary: Dict[str, str]) -> str:
        """Helper to apply phonetic replacements safely using whole-word regex matches."""
        if not dictionary:
            return text
            
        processed_text = text
        for word, replacement in dictionary.items():
            # Use regex to replace whole words only (case-insensitive)
            # This prevents replacing "he" inside "the"
            # Note: \b works well for English/Russian/Spanish/Romanian. 
            # For Hebrew, we might need a more specialized regex if \b doesn't cover all edge cases, 
            # but for an MVP this is the standard approach.
            pattern = re.compile(rf'\b{re.escape(word)}\b', re.IGNORECASE)
            processed_text = pattern.sub(replacement, processed_text)
            
        return processed_text

class EnglishPreprocessor(BasePreprocessor):
    def process(self, text: str, dictionary: Dict[str, str]) -> str:
        return self.apply_dictionary(text, dictionary)

class RomanianPreprocessor(BasePreprocessor):
    def process(self, text: str, dictionary: Dict[str, str]) -> str:
        return self.apply_dictionary(text, dictionary)

class SpanishPreprocessor(BasePreprocessor):
    def process(self, text: str, dictionary: Dict[str, str]) -> str:
        return self.apply_dictionary(text, dictionary)

class HebrewPreprocessor(BasePreprocessor):
    def process(self, text: str, dictionary: Dict[str, str]) -> str:
        return self.apply_dictionary(text, dictionary)

class RussianPreprocessor(BasePreprocessor):
    def __init__(self, language_code: str):
        super().__init__(language_code)
        self._accentuator = None

    def _get_accentuator(self):
        """Lazy load ruaccent so it doesn't consume RAM if not processing Russian."""
        if self._accentuator is None:
            print("[RussianPreprocessor] Loading ruaccent model...")
            from ruaccent import RUAccent
            import ruaccent.accent_model
            import numpy as np
            
            # Monkey-patch AccentModel.put_accent to fix missing token_type_ids in ONNX input
            original_put_accent = ruaccent.accent_model.AccentModel.put_accent
            def patched_put_accent(self_obj, word):
                def softmax(x):
                    e_x = np.exp(x - np.max(x))
                    return e_x / e_x.sum(axis=-1, keepdims=True)
                lower_word = word.lower()
                inputs = self_obj.tokenizer(lower_word, return_tensors="np")
                inputs = {k: v.astype(np.int64) for k, v in inputs.items()}
                if "token_type_ids" not in inputs:
                    inputs["token_type_ids"] = np.zeros_like(inputs["input_ids"])
                outputs = self_obj.session.run(None, inputs)
                output_names = {output_key.name: idx for idx, output_key in enumerate(self_obj.session.get_outputs())}
                logits = outputs[output_names["logits"]]
                probabilities = softmax(logits)
                scores = np.max(probabilities, axis=-1)[0]
                labels = np.argmax(logits, axis=-1)[0]
                pred_with_scores = [{'label': self_obj.id2label[str(label)], 'score': float(score)} 
                                    for label, score in zip(labels, scores)]
                stressed_word = self_obj.render_stress(word, pred_with_scores)
                return stressed_word

            ruaccent.accent_model.AccentModel.put_accent = patched_put_accent

            # Initialize the model (using default or lightweight parameters depending on requirements)
            self._accentuator = RUAccent()
            self._accentuator.load(omograph_model_size='big_poetry', use_dictionary=True)
            print("[RussianPreprocessor] ruaccent model loaded.")
        return self._accentuator

    def process(self, text: str, dictionary: Dict[str, str]) -> str:
        """
        Flow for Russian:
        1. Clean and stem dictionary words to support standard inflected case/adjective endings.
        2. Replace dictionary words with unique English placeholders (e.g. CWORD0) while preserving case.
        3. Pass text through ruaccent (it ignores English placeholders).
        4. Replace placeholders with the corresponding stemmed user phonetic replacements.
        5. Convert '+' to Unicode Combining Acute Accent (\u0301).
        Priority: User Dictionary > ruaccent ML.
        """
        protected_text = text
        placeholder_map = {}
        
        if dictionary:
            for i, (word, replacement) in enumerate(dictionary.items()):
                word_clean = word.strip()
                replacement_clean = replacement.strip()
                
                stem = word_clean
                rep_stem = replacement_clean
                
                # If the word ends with a standard trailing sign or vowel, extract its stem
                if word_clean and word_clean[-1].lower() in 'аяоеиыьй':
                    stem = word_clean[:-1]
                    if replacement_clean and replacement_clean[-1].lower() == word_clean[-1].lower():
                        rep_stem = replacement_clean[:-1]
                    elif replacement_clean and replacement_clean[-1] == '+':
                        if len(replacement_clean) >= 2 and replacement_clean[-2].lower() == word_clean[-1].lower():
                            rep_stem = replacement_clean[:-2] + '+'
                
                placeholder = f"CWORD{i}"
                placeholder_map[placeholder] = rep_stem
                placeholder_map[placeholder.lower()] = rep_stem[0].lower() + rep_stem[1:] if rep_stem else ""
                
                escaped_stem = re.escape(stem)
                # Group of standard Russian grammatical endings
                ru_endings = r'(?:[ьЬ])?(?:[аяуюеыиоАЯУЮЕЫИО]|ов|ей|ам|ям|ом|ем|ой|ей|ью|ами|ями|ах|ях|ский|ская|ское|ские|ского|скому|ским|ском|ских|скими|ски|ОВ|ЕЙ|АМ|ЯМ|ОМ|ЕМ|ОЙ|ЕЙ|ЬЮ|АМИ|ЯМИ|АХ|ЯХ|СКИЙ|СКАЯ|СКОЕ|СКИЕ|СКОГО|СКОМУ|СКИМ|СКОМ|СКИХ|СКИМИ|СКИ)?'
                pattern = re.compile(rf'\b{escaped_stem}({ru_endings})\b', re.IGNORECASE)
                
                def make_replace(match_obj, _ph=placeholder):
                    matched_str = match_obj.group(0)
                    ending = match_obj.group(1)
                    is_lower = matched_str[0].islower() if matched_str else False
                    p_with_case = _ph.lower() if is_lower else _ph
                    return f"{p_with_case}{ending}"

                protected_text = pattern.sub(make_replace, protected_text)

        accentuator = self._get_accentuator()
        try:
            processed_text = accentuator.process_all(protected_text)
        except Exception as e:
            logger.warning("[RussianPreprocessor] ruaccent failed (%s), using original text.", e)
            processed_text = protected_text

        final_text = processed_text
        if dictionary:
            # Sort keys by length in descending order to prevent shorter placeholders (e.g. CWORD1)
            # from matching inside longer ones (e.g. CWORD13)
            for placeholder in sorted(placeholder_map.keys(), key=len, reverse=True):
                replacement = placeholder_map[placeholder]
                final_text = final_text.replace(placeholder, replacement)
            
        # Convert '+' to Unicode Combining Acute Accent (\u0301)
        final_text = re.sub(r'\+(.)', r'\1' + '\u0301', final_text)

        # Replace 'ё'/'Ё' with 'ьо'/'Ьо' because Gemini 3.1 TTS mispronounces 'ё' as 'е'
        final_text = final_text.replace('ё', 'ьо').replace('Ё', 'Ьо')
            
        return final_text

class PreprocessorFactory:
    _instances: Dict[str, BasePreprocessor] = {}

    @classmethod
    def get_preprocessor(cls, language_code: str) -> BasePreprocessor:
        """
        Returns the appropriate preprocessor singleton for the given language.
        Example language_code: 'en-US', 'ru-RU', 'ro-RO', 'he-IL', 'es-ES'.
        """
        prefix = language_code.lower().split('-')[0]  # Extract 'en', 'ru', 'ro', etc.
        
        if prefix not in cls._instances:
            match prefix:
                case 'ru':
                    cls._instances[prefix] = RussianPreprocessor(language_code)
                case 'en':
                    cls._instances[prefix] = EnglishPreprocessor(language_code)
                case 'ro':
                    cls._instances[prefix] = RomanianPreprocessor(language_code)
                case 'es':
                    cls._instances[prefix] = SpanishPreprocessor(language_code)
                case 'he':
                    cls._instances[prefix] = HebrewPreprocessor(language_code)
                case _:
                    # Fallback to English/Default for unknown languages
                    cls._instances[prefix] = EnglishPreprocessor(language_code)
                
        return cls._instances[prefix]
