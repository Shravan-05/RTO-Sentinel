import re
import json
import logging
import urllib.request
import urllib.error
from typing import Dict, Any, List
from app.core.config import settings
from app.schemas.order import AddressValidationResult

logger = logging.getLogger("rto_sentinel.llm")

SUSPICIOUS_NAMES = {"asdf", "test", "demo", "admin", "unknown", "qwerty", "na", "null", "none", "xyz", "abc", "user", "customer"}
VAGUE_PATTERNS = [
    r"^(home|house|flat|room|office|shop)$",
    r"^(near\s+[a-z\s]+)$",
    r"^(call\s+me|call\s+before\s+delivery|phone\s+karo)$",
    r"^(\.|\-|\,|\/)+$",
    r"^(xyz|abc|test|asdf|qwerty)$",
    r"^[0-9\s\.\-\/]+$"
]

LANDMARK_KEYWORDS = [
    "near", "opp", "opposite", "behind", "beside", "adjacent", "close to",
    "ke paas", "ke saamne", "ke peeche", "samne", "paas", "peeche", "baju mein", "bagal mein",
    "metro", "station", "temple", "mandir", "masjid", "mosque", "church", "gurudwara",
    "school", "college", "hospital", "bank", "atm", "market", "bazar", "complex",
    "tower", "building", "apartment", "road", "street", "gali", "gali no", "nagar", "colony",
    "chowk", "circle", "floor", "flat", "door", "house", "h.no", "plot", "sector"
]

def rule_based_address_evaluation(address: str, city: str, state: str, pincode: str, customer_name: str = "") -> AddressValidationResult:
    """
    Robust Indian e-commerce address quality evaluator.
    Analyzes completeness, door/flat numbers, landmarks, pincode format, and suspicious names.
    """
    clean_addr = (address or "").strip()
    clean_addr_lower = clean_addr.lower()
    clean_name = (customer_name or "").strip().lower()
    clean_pin = str(pincode or "").strip()
    
    issues: List[str] = []
    score = 100
    category = "COMPLETE"
    
    # 1. Length & Word Count Check
    words = clean_addr.split()
    if len(clean_addr) < 8 or len(words) < 2:
        issues.append("Address is dangerously short (<8 characters). High risk of delivery failure.")
        score -= 50
        category = "VAGUE"
    elif len(clean_addr) < 18 or len(words) < 3:
        issues.append("Address has very few details (<3 words). Missing street or locality.")
        score -= 30
        category = "MISSING_LANDMARK"
        
    # 2. Vague & Gibberish Patterns
    for pattern in VAGUE_PATTERNS:
        if re.search(pattern, clean_addr_lower):
            issues.append(f"Address matches placeholder or vague text ('{clean_addr}').")
            score -= 60
            category = "GIBBERISH"
            break
            
    # Check for repetitive characters (e.g., 'aaaaaa', '111111')
    if re.search(r"(.)\1{4,}", clean_addr_lower):
        issues.append("Address contains repetitive gibberish characters.")
        score -= 40
        category = "GIBBERISH"

    # 3. Landmark & House Number Presence
    has_number = bool(re.search(r"\d+", clean_addr))
    has_landmark = any(kw in clean_addr_lower for kw in LANDMARK_KEYWORDS)
    
    if not has_number and not has_landmark:
        issues.append("Missing both house/flat number and recognizable landmark.")
        score -= 25
        if category == "COMPLETE":
            category = "MISSING_LANDMARK"
    elif not has_landmark:
        issues.append("No prominent landmark or sector/locality identifier detected.")
        score -= 10
        if category == "COMPLETE":
            category = "MISSING_LANDMARK"

    # 4. Pincode Validation
    if not re.match(r"^[1-9][0-9]{5}$", clean_pin):
        issues.append(f"Invalid postal code format '{clean_pin}'. Must be a 6-digit Indian PIN.")
        score -= 35
        category = "INVALID_PINCODE"

    # 5. Customer Name Quality
    if clean_name in SUSPICIOUS_NAMES or len(clean_name) <= 2:
        issues.append(f"Customer name '{customer_name}' appears to be a pseudonym or dummy entry.")
        score -= 20

    score = max(5, min(100, score))
    is_valid = score >= 50 and category not in ["GIBBERISH", "VAGUE", "INVALID_PINCODE"]
    
    # Suggested correction
    suggested_correction = None
    if not is_valid or score < 75:
        suggestions = []
        if not has_number:
            suggestions.append("house/flat number")
        if not has_landmark:
            suggestions.append("prominent nearby landmark (school, temple, shop, or colony name)")
        if len(suggestions) > 0:
            suggested_correction = f"Request customer to provide: {', '.join(suggestions)}."
        else:
            suggested_correction = "Request complete postal street address with valid house/building details."

    return AddressValidationResult(
        is_valid=is_valid,
        quality_score=score,
        category=category,
        issues=issues,
        suggested_correction=suggested_correction,
        validation_source="RULE_BASED"
    )

def validate_address_with_gemini(address: str, city: str, state: str, pincode: str, customer_name: str = "") -> AddressValidationResult:
    """
    Validates delivery address using Gemini API if key is available,
    otherwise uses the rule-based evaluator with graceful fallback.
    """
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return rule_based_address_evaluation(address, city, state, pincode, customer_name)
    
    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        prompt = f"""
You are an expert Indian e-commerce logistics delivery address validator.
Analyze the following delivery address:
- Address: "{address}"
- City: "{city}"
- State: "{state}"
- Pincode: "{pincode}"
- Customer Name: "{customer_name}"

Evaluate deliverability, house/door number, landmark, locality clarity, and dummy text.
Respond ONLY with a valid JSON object matching this schema:
{{
  "is_valid": true|false,
  "quality_score": integer between 0 and 100,
  "category": "COMPLETE" | "MISSING_LANDMARK" | "VAGUE" | "GIBBERISH" | "INVALID_PINCODE",
  "issues": ["list of short issue strings"],
  "suggested_correction": "short string with what to ask the customer, or null"
}}
Do not enclose in markdown blocks. Return raw JSON only.
"""
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "temperature": 0.1,
                "response_mime_type": "application/json"
            }
        }
        
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        
        with urllib.request.urlopen(req, timeout=5) as response:
            result = json.loads(response.read().decode("utf-8"))
            raw_text = result["candidates"][0]["content"]["parts"][0]["text"].strip()
            data = json.loads(raw_text)
            
            return AddressValidationResult(
                is_valid=bool(data.get("is_valid", True)),
                quality_score=int(data.get("quality_score", 70)),
                category=str(data.get("category", "COMPLETE")),
                issues=list(data.get("issues", [])),
                suggested_correction=data.get("suggested_correction"),
                validation_source="GEMINI_AI"
            )
            
    except Exception as e:
        logger.warning(f"Gemini address validation failed: {e}. Falling back to rule engine.")
        res = rule_based_address_evaluation(address, city, state, pincode, customer_name)
        res.validation_source = "RULE_BASED (GEMINI_FALLBACK)"
        return res

