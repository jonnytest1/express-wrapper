export class ResponseCodeError extends Error {
    public reason;


    constructor(public code: number, reason: string) {
        super(undefined);
        if (typeof reason == "string") {
            this.reason = {
                message: reason
            }
        } else if (typeof reason == "object") {
            this.reason = reason
        }


    }
}