import axios from "axios";

// Google Translate Supported Languages
export const SUPPORTED_LANGUAGES = {
    // A-D
    'ab': 'Abkhaz',
    'ace': 'Acehnese',
    'ach': 'Acholi',
    'af': 'Afrikaans',
    'sq': 'Albanian',
    'alz': 'Alur',
    'am': 'Amharic',
    'ar': 'Arabic',
    'hy': 'Armenian',
    'as': 'Assamese',
    'awa': 'Awadhi',
    'ay': 'Aymara',
    'az': 'Azerbaijani',
    'ban': 'Balinese',
    'bm': 'Bambara',
    'ba': 'Bashkir',
    'eu': 'Basque',
    'btx': 'Batak Karo',
    'bts': 'Batak Simalungun',
    'bbc': 'Batak Toba',
    'be': 'Belarusian',
    'bem': 'Bemba',
    'bn': 'Bengali',
    'bew': 'Betawi',
    'bho': 'Bhojpuri',
    'bik': 'Bikol',
    'bs': 'Bosnian',
    'br': 'Breton',
    'bg': 'Bulgarian',
    'bua': 'Buryat',
    'yue': 'Cantonese',
    'ca': 'Catalan',
    'ceb': 'Cebuano',
    'ny': 'Chichewa (Nyanja)',
    'zh-CN': 'Chinese (Simplified)',
    'zh': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    'cv': 'Chuvash',
    'co': 'Corsican',
    'crh': 'Crimean Tatar',
    'hr': 'Croatian',
    'cs': 'Czech',
    'da': 'Danish',
    'din': 'Dinka',
    'dv': 'Divehi',
    'doi': 'Dogri',
    'dov': 'Dombe',
    'nl': 'Dutch',
    'dz': 'Dzongkha',

    // E-H
    'en': 'English',
    'eo': 'Esperanto',
    'et': 'Estonian',
    'ee': 'Ewe',
    'fj': 'Fijian',
    'fil': 'Filipino (Tagalog)',
    'tl': 'Filipino (Tagalog)',
    'fi': 'Finnish',
    'fr': 'French',
    'fr-FR': 'French (France)',
    'fr-CA': 'French (Canada)',
    'fy': 'Frisian',
    'ff': 'Fulfulde',
    'gaa': 'Ga',
    'gl': 'Galician',
    'lg': 'Ganda (Luganda)',
    'ka': 'Georgian',
    'de': 'German',
    'el': 'Greek',
    'gn': 'Guarani',
    'gu': 'Gujarati',
    'ht': 'Haitian Creole',
    'cnh': 'Hakha Chin',
    'ha': 'Hausa',
    'haw': 'Hawaiian',
    'he': 'Hebrew',
    'iw': 'Hebrew',
    'hil': 'Hiligaynon',
    'hi': 'Hindi',
    'hmn': 'Hmong',
    'hu': 'Hungarian',
    'hrx': 'Hunsrik',

    // I-M
    'is': 'Icelandic',
    'ig': 'Igbo',
    'ilo': 'Iloko',
    'id': 'Indonesian',
    'ga': 'Irish',
    'it': 'Italian',
    'ja': 'Japanese',
    'jw': 'Javanese',
    'jv': 'Javanese',
    'kn': 'Kannada',
    'pam': 'Kapampangan',
    'kk': 'Kazakh',
    'km': 'Khmer',
    'cgg': 'Kiga',
    'rw': 'Kinyarwanda',
    'ktu': 'Kituba',
    'gom': 'Konkani',
    'ko': 'Korean',
    'kri': 'Krio',
    'ku': 'Kurdish (Kurmanji)',
    'ckb': 'Kurdish (Sorani)',
    'ky': 'Kyrgyz',
    'lo': 'Lao',
    'ltg': 'Latgalian',
    'la': 'Latin',
    'lv': 'Latvian',
    'lij': 'Ligurian',
    'li': 'Limburgan',
    'ln': 'Lingala',
    'lt': 'Lithuanian',
    'lmo': 'Lombard',
    'luo': 'Luo',
    'lb': 'Luxembourgish',
    'mk': 'Macedonian',
    'mai': 'Maithili',
    'mak': 'Makassar',
    'mg': 'Malagasy',
    'ms': 'Malay',
    'ms-Arab': 'Malay (Jawi)',
    'ml': 'Malayalam',
    'mt': 'Maltese',
    'mi': 'Maori',
    'mr': 'Marathi',
    'chm': 'Meadow Mari',
    'mni-Mtei': 'Meiteilon (Manipuri)',
    'min': 'Minang',
    'lus': 'Mizo',
    'mn': 'Mongolian',
    'my': 'Myanmar (Burmese)',

    // N-R
    'nr': 'Ndebele (South)',
    'new': 'Nepalbhasa (Newari)',
    'ne': 'Nepali',
    'nso': 'Northern Sotho (Sepedi)',
    'no': 'Norwegian',
    'nus': 'Nuer',
    'oc': 'Occitan',
    'or': 'Odia (Oriya)',
    'om': 'Oromo',
    'pag': 'Pangasinan',
    'pap': 'Papiamento',
    'ps': 'Pashto',
    'fa': 'Persian',
    'pl': 'Polish',
    'pt': 'Portuguese',
    'pt-PT': 'Portuguese (Portugal)',
    'pt-BR': 'Portuguese (Brazil)',
    'pa': 'Punjabi',
    'pa-Arab': 'Punjabi (Shahmukhi)',
    'qu': 'Quechua',
    'rom': 'Romani',
    'ro': 'Romanian',
    'rn': 'Rundi',
    'ru': 'Russian',

    // S-Z
    'sm': 'Samoan',
    'sg': 'Sango',
    'sa': 'Sanskrit',
    'gd': 'Scots Gaelic',
    'sr': 'Serbian',
    'st': 'Sesotho',
    'crs': 'Seychellois Creole',
    'shn': 'Shan',
    'sn': 'Shona',
    'scn': 'Sicilian',
    'szl': 'Silesian',
    'sd': 'Sindhi',
    'si': 'Sinhala (Sinhalese)',
    'sk': 'Slovak',
    'sl': 'Slovenian',
    'so': 'Somali',
    'es': 'Spanish',
    'su': 'Sundanese',
    'sw': 'Swahili',
    'ss': 'Swati',
    'sv': 'Swedish',
    'tg': 'Tajik',
    'ta': 'Tamil',
    'tt': 'Tatar',
    'te': 'Telugu',
    'tet': 'Tetum',
    'th': 'Thai',
    'ti': 'Tigrinya',
    'ts': 'Tsonga',
    'tn': 'Tswana',
    'tr': 'Turkish',
    'tk': 'Turkmen',
    'ak': 'Twi (Akan)',
    'uk': 'Ukrainian',
    'ur': 'Urdu',
    'ug': 'Uyghur',
    'uz': 'Uzbek',
    'vi': 'Vietnamese',
    'cy': 'Welsh',
    'xh': 'Xhosa',
    'yi': 'Yiddish',
    'yo': 'Yoruba',
    'yua': 'Yucatec Maya',
    'zu': 'Zulu'
};

// Most commonly used languages for dropdown
export const POPULAR_LANGUAGES = {
    'auto': 'Auto Detect',
    'en': 'English',
    'bn': 'Bengali (বাংলা)',
    'hi': 'Hindi (हिन्दी)',
    'ur': 'Urdu (اردو)',
    'ar': 'Arabic (العربية)',
    'zh-CN': 'Chinese Simplified (中文简体)',
    'zh-TW': 'Chinese Traditional (中文繁體)',
    'es': 'Spanish (Español)',
    'fr': 'French (Français)',
    'de': 'German (Deutsch)',
    'it': 'Italian (Italiano)',
    'pt': 'Portuguese (Português)',
    'ru': 'Russian (Русский)',
    'ja': 'Japanese (日本語)',
    'ko': 'Korean (한국어)',
    'th': 'Thai (ไทย)',
    'vi': 'Vietnamese (Tiếng Việt)',
    'id': 'Indonesian (Bahasa Indonesia)',
    'ms': 'Malay (Bahasa Melayu)',
    'tr': 'Turkish (Türkçe)',
    'fa': 'Persian (فارسی)',
    'ta': 'Tamil (தமிழ்)',
    'te': 'Telugu (తెలుగు)',
    'ml': 'Malayalam (മലയാളം)',
    'kn': 'Kannada (ಕನ್ನಡ)',
    'gu': 'Gujarati (ગુજરાતી)',
    'mr': 'Marathi (मराठी)',
    'pa': 'Punjabi (ਪੰਜਾਬੀ)'
};

// Language detection function
export const detectLanguage = async (text: string): Promise<string> => {
    try {
        if (!text || text.trim().length === 0) {
            return 'auto';
        }

        const response = await axios.get(`https://translate.googleapis.com/translate_a/single`, {
            params: {
                client: 'gtx',
                sl: 'auto',
                tl: 'en',
                dt: 't',
                q: text.substring(0, 500), // Limit text length for detection
            },
            timeout: 10000,
        });

        // Google Translate API returns detected language in response[2]
        const detectedLang = response.data[2];
        return detectedLang || 'auto';
    } catch (error: any) {
        console.error("Language detection error:", error.message);
        return 'auto';
    }
};

// Main translation function - FIXED VERSION
export const translateText = async (text: string, targetLang: string, sourceLang: string = 'auto'): Promise<string> => {
    try {
        // Validate inputs
        if (!text || text.trim().length === 0) {
            return text;
        }

        if (sourceLang === targetLang) {
            return text;
        }

        if (!isLanguageSupported(targetLang) || (sourceLang !== 'auto' && !isLanguageSupported(sourceLang))) {
            console.warn(`Unsupported language: source=${sourceLang}, target=${targetLang}`);
            return text;
        }

        // Using Google Translate API
        const response = await axios.get(`https://translate.googleapis.com/translate_a/single`, {
            params: {
                client: 'gtx',
                sl: sourceLang,
                tl: targetLang,
                dt: 't',
                q: text,
            },
            timeout: 15000, // 15 second timeout
        });

        const responseData = response.data;

        // Validate response structure
        if (!responseData) {
            console.warn("Empty response from translation API");
            return text;
        }

        // Handle the standard response structure: [[[translatedText, originalText], ...], ...]
        if (Array.isArray(responseData) && responseData[0] && Array.isArray(responseData[0])) {
            let translatedText = '';

            // Concatenate all translation segments
            for (const segment of responseData[0]) {
                if (Array.isArray(segment) && segment[0] && typeof segment[0] === 'string') {
                    translatedText += segment[0];
                }
            }

            if (translatedText) {
                return translatedText;
            }
        }

        console.warn("Unexpected response structure from translation API:", responseData);
        return text;

    } catch (error: any) {
        console.error("Translation error:", error.message);

        // Handle specific error cases
        if (error.code === 'ECONNABORTED') {
            console.warn("Translation request timeout");
        } else if (error.response) {
            console.warn(`Translation API error: ${error.response.status} - ${error.response.statusText}`);
        } else if (error.request) {
            console.warn("No response received from translation API");
        }

        return text;
    }
};

// Alternative robust translation function with better error handling
export const translateTextRobust = async (text: string, targetLang: string, sourceLang: string = 'auto'): Promise<string> => {
    try {
        if (!text || text.trim().length === 0) return text;
        if (sourceLang === targetLang) return text;

        const response = await axios.get(`https://translate.googleapis.com/translate_a/single`, {
            params: {
                client: 'gtx',
                sl: sourceLang,
                tl: targetLang,
                dt: 't',
                q: text,
            },
            timeout: 10000,
        });

        const data = response.data;

        // Recursive function to find translation in nested structures
        const findTranslation = (obj: any): string => {
            if (typeof obj === 'string') {
                return obj;
            }

            if (Array.isArray(obj)) {
                // Check if this is a translation segment: [translatedText, originalText]
                if (obj.length >= 1 && typeof obj[0] === 'string') {
                    return obj[0];
                }

                // Recursively search through arrays
                for (const item of obj) {
                    const result = findTranslation(item);
                    if (result && result !== text) { // Avoid returning original text
                        return result;
                    }
                }
            }

            return '';
        };

        const translation = findTranslation(data);
        return translation || text;

    } catch (error: any) {
        console.error("Robust translation error:", error.message);
        return text;
    }
};

// Batch translation function for multiple texts
export const translateMultiple = async (texts: string[], targetLang: string, sourceLang: string = 'auto'): Promise<string[]> => {
    try {
        if (!texts || texts.length === 0) return texts;

        const translations = await Promise.all(
            texts.map(text => translateText(text, targetLang, sourceLang))
        );

        return translations;
    } catch (error: any) {
        console.error("Batch translation error:", error.message);
        return texts; // Return original texts on error
    }
};

// Helper function to get language name from code
export const getLanguageName = (code: string): string => {
    return SUPPORTED_LANGUAGES[code as keyof typeof SUPPORTED_LANGUAGES] || code;
};

// Helper function to get all language codes
export const getAllLanguageCodes = (): string[] => {
    return Object.keys(SUPPORTED_LANGUAGES);
};

// Helper function to search languages
export const searchLanguages = (query: string): { [key: string]: string } => {
    const filtered: { [key: string]: string } = {};
    const lowerQuery = query.toLowerCase();

    Object.entries(SUPPORTED_LANGUAGES).forEach(([code, name]) => {
        if (name.toLowerCase().includes(lowerQuery) || code.toLowerCase().includes(lowerQuery)) {
            filtered[code] = name;
        }
    });

    return filtered;
};

// Function to validate if a language code is supported
export const isLanguageSupported = (code: string): boolean => {
    return code in SUPPORTED_LANGUAGES || code === 'auto';
};

// Function to get language code from name
export const getLanguageCode = (name: string): string | null => {
    const entry = Object.entries(SUPPORTED_LANGUAGES).find(([code, langName]) =>
        langName.toLowerCase() === name.toLowerCase()
    );
    return entry ? entry[0] : null;
};

// Function to get popular languages as array for dropdowns
export const getPopularLanguages = (): Array<{ code: string; name: string }> => {
    return Object.entries(POPULAR_LANGUAGES).map(([code, name]) => ({
        code,
        name
    }));
};

// Function to get all languages as array for dropdowns
export const getAllLanguages = (): Array<{ code: string; name: string }> => {
    return Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => ({
        code,
        name
    }));
};

// Utility to check if text needs translation (simple heuristic)
export const needsTranslation = (text: string, targetLang: string): boolean => {
    // Simple check - in real app, you might want more sophisticated detection
    if (!text || text.trim().length === 0) return false;

    // Check if text contains non-ASCII characters when target is English
    if (targetLang === 'en') {
        const hasNonAscii = /[^\x00-\x7F]/.test(text);
        return hasNonAscii;
    }

    return true;
};

// Export default for convenience
export default {
    SUPPORTED_LANGUAGES,
    POPULAR_LANGUAGES,
    detectLanguage,
    translateText,
    translateTextRobust,
    translateMultiple,
    getLanguageName,
    getAllLanguageCodes,
    searchLanguages,
    isLanguageSupported,
    getLanguageCode,
    getPopularLanguages,
    getAllLanguages,
    needsTranslation
};