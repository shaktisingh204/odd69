import { AuthService } from './auth.service';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    login(req: any): Promise<{
        access_token: string;
        user: any;
    } | {
        message: string;
        status: number;
    }>;
    signup(signUpDto: {
        email?: string;
        phoneNumber?: string;
        password: string;
        username?: string;
        currency?: string;
        bonus_id?: string;
    }): Promise<{
        access_token: string;
        user: any;
    }>;
    getProfile(req: any): any;
}
