import { Express, Request } from 'express';
export interface ExpressWs extends Express {
    ws(path, cb: (ws: Websocket, req: Request) => void)
}


type eventType = "message" | "close" | "error"
enum ReadyState { OPEN, CLOSED }
export interface Websocket {
    on: (type: string, cb: (data) => void) => void

    send(data: string)

    close()


    readyState: ReadyState

    OPEN: ReadyState.OPEN

    CLOSED: ReadyState.CLOSED
}

export const exportThisFilePls = ""