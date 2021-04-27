import { Express, Request } from 'express';
export interface ExpressWs extends Express {
    ws(path, cb: (ws: Websocket, req: Request) => void)
}

export interface Websocket {
    on: (type: string, cb: (data) => void) => void

    send(data: string)

    close()
}