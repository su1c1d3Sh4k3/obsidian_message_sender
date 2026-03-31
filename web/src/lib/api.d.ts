export declare function uploadFile(file: File | Blob, filename?: string): Promise<{
    url: string;
    mimetype: string;
}>;
export declare const api: {
    get: <T>(path: string) => Promise<T>;
    post: <T>(path: string, body?: unknown) => Promise<T>;
    put: <T>(path: string, body?: unknown) => Promise<T>;
    delete: <T>(path: string) => Promise<T>;
};
//# sourceMappingURL=api.d.ts.map