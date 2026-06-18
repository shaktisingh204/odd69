import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class HuiduCryptoService {
    private readonly logger = new Logger(HuiduCryptoService.name);
    private readonly configAlgorithm = 'aes-256-ecb';

    encrypt(payloadObj: any, aesKey: string): string {
        try {
            const jsonString = typeof payloadObj === 'string' ? payloadObj : JSON.stringify(payloadObj);
            const cipher = crypto.createCipheriv(this.configAlgorithm, Buffer.from(aesKey, 'utf8'), null);
            cipher.setAutoPadding(true);
            let encrypted = cipher.update(jsonString, 'utf8', 'base64');
            encrypted += cipher.final('base64');
            return encrypted;
        } catch (error) {
            this.logger.error('Encryption failed', error);
            throw new Error('Encryption failed');
        }
    }

    decrypt(base64Payload: string, aesKey: string): any {
        try {
            const decipher = crypto.createDecipheriv(this.configAlgorithm, Buffer.from(aesKey, 'utf8'), null);
            decipher.setAutoPadding(true);
            let decrypted = decipher.update(base64Payload, 'base64', 'utf8');
            decrypted += decipher.final('utf8');
            return JSON.parse(decrypted);
        } catch (error) {
            this.logger.error('Decryption failed', error);
            throw new Error('Decryption failed');
        }
    }
}
