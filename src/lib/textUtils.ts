/**
 * Text formatting and manipulation utilities
 */

/**
 * Returns the plural form of a word based on count
 * @param count - The count to check
 * @param singular - The singular form of the word
 * @param plural - The plural form (defaults to singular + 's')
 */
export function pluralize(count: number, singular: string, plural?: string): string {
    if (count === 1) {
        return singular;
    }
    return plural || `${singular}s`;
}

/**
 * Returns the word with optional 's' suffix based on count
 * Example: formatPlural(2, "action") => "actions"
 */
export function formatPlural(count: number, word: string): string {
    return count === 1 ? word : `${word}s`;
}
