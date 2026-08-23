type FieldMapping = Map<string, string>;

export const FIELD_MAPPINGS = {
    phone: ['phone', 'phon', 'phoneNumber', 'numberOfPhone', 'phone_number', 'phoneNum', 'tel', 'telephone'],
    email: ['email', 'emailAddress', 'email_address', 'mail', 'emailAddr'],
    name: ['name', 'fullName', 'full_name', 'userName', 'user_name', 'username'],
    firstName: ['firstName', 'first_name', 'fname'],
    lastName: ['lastName', 'last_name', 'lname'],
    id: ['id', 'uuid', 'userId', 'user_id', 'yauid'],
    age: ['age', 'years', 'yearsOld', 'years_old'],
    address: ['address', 'addr', 'location', 'streetAddress', 'street_address'],
    date: ['date', 'createdAt', 'created_at', 'timestamp', 'time'],
};


export function collapseKey(key: string, fieldMapping: FieldMapping): string {
    const camelKey = toCamelCase(key);
    const lowerKey = camelKey.toLowerCase();
    
    if (fieldMapping.has(lowerKey)) {
        return fieldMapping.get(lowerKey)!;
    }
    
    for (const [variant, canonical] of fieldMapping) {
        if (lowerKey.includes(variant) || variant.includes(lowerKey)) {
            return canonical;
        }
    }
    
    return camelKey;
}


export function toCamelCase(key: string): string {
    const normalized = key.replace(/[^a-zA-Z0-9]/g, '_');
    
    return normalized
        .split('_')
        .map((word, index) => {
            if (index === 0) {
                return word.toLowerCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join('');
}

export function createFieldMapping(variants: string[], canonical: string): FieldMapping {
    const mapping = new Map<string, string>();
    for (const variant of variants) {
        mapping.set(variant.toLowerCase(), canonical);
    }
    return mapping;
}

export function getDefaultFieldMapping(): FieldMapping {
    const mapping = new Map<string, string>();
    
    for (const [canonical, variants] of Object.entries(FIELD_MAPPINGS)) {
        const fieldMapping = createFieldMapping(variants, canonical);
        fieldMapping.forEach((value, key) => mapping.set(key, value));
    }
    
    return mapping;
}
