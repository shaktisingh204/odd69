export class CreateHomeCategoryDto {
    title: string;
    subtitle?: string;
    description?: string;
    image?: string;
    link: string;
    isLarge?: boolean;
    order?: number;
    isActive?: boolean;
    style?: any;
}
