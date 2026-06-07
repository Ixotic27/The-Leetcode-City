export interface CityDeveloper {
    id: number;
    github_login: string;
    [key: string]: unknown;
}

export interface CityStats {
    total_developers: number;
    total_contributions: number;
}