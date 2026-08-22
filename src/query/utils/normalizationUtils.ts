import { normalizePhone as normalizePhoneUtil } from "../../servers/types/phone";
import { EmailType } from "../../servers/types/emailType";

type Normalizer = (value: any) => any;

const normalizers: Record<string, Normalizer> = {
    phone: (value: any): string => {
        if (typeof value !== 'string') return value;
        return normalizePhoneUtil(value);
    },
    
    email: (value: any): string => {
        if (typeof value !== 'string') return value;
        return EmailType.normalize(value);
    },
    
    name: (value: any): string => {
        if (typeof value !== 'string') return value;
        return value.trim().replace(/\s+/g, ' ');
    }
};

export function normalizeValue(key: string, value: any): any {
    if (value === null || value === undefined) {
        return value;
    }

    const normalizer = normalizers[key];
    
    if (normalizer) {
        return normalizer(value);
    }
    
    return value;
}

export function registerNormalizer(fieldType: string, normalizer: Normalizer): void {
    normalizers[fieldType] = normalizer;
}

export function getNormalizerTypes(): string[] {
    return Object.keys(normalizers);
}
