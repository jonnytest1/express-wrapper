const express = require('express');
import { Express, Request, Response, } from 'express';

import { promises } from 'fs';
import type * as core from 'express-serve-static-core';
import { join } from 'path';
import { ExpressWs, Websocket } from './express-ws-type';
import { ResponseCodeError } from './response-code-error';

export interface HttpRequest<
    User = any,
    AttributeType extends { [Key: string]: Primitive } = { [Key: string]: Primitive },
    P = core.ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = core.Query,
    Locals extends Record<string, any> = Record<string, any>> extends Request<P, ResBody, ReqBody, ReqQuery, Locals> {
    user?: User

    attributes?: AttributeType
}

export type HttpResponse = Response;

export type Primitive = string | number | boolean

export const resources: Array<{
    type: 'get' | 'post' | 'delete' | 'put' | 'ws',
    path: string
    attributes?: { [Key: string]: Primitive }
    target: any
    callback(req, res): Promise<void>,
}> = [];

export function Path(subPath?: string) {
    return (target: { path?: string, name: string }) => {
        let sPath = subPath;
        if (sPath === undefined) {
            sPath = target.name.toLowerCase();
        }
        if (target.path) {
            sPath = `${target.path}/${sPath}`;
        }
        target.path = sPath;
    };
}

function resourceFunction<T = (req: HttpRequest, res: HttpResponse) => Promise<any>>(method: typeof resources[0]['type'], options: { path: string; }) {
    return (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) => {
        resources.push({
            callback: target[propertyKey],
            type: method,
            path: options.path,
            target
        });
    };
}

export function WS(options: BasePathProperties | string) {
    if (typeof options == "string") {
        options = { path: options }
    }
    return resourceFunction('ws', options) as any;
}

export function GET(options: BasePathProperties | string) {
    if (typeof options == "string") {
        options = { path: options }
    }
    return resourceFunction('get', options);
}
export function POST(options: BasePathProperties | string) {
    if (typeof options == "string") {
        options = { path: options }
    }
    return resourceFunction('post', options);
}

type BasePathProperties = {
    path: string;
    attributes?: { [Key: string]: Primitive }
};

export function PUT(options: BasePathProperties | string) {
    if (typeof options == "string") {
        options = { path: options }
    }
    return resourceFunction('put', options);
}

export async function initialize(rootpath: string, options?: {
    public?: string
    allowCors?: boolean
    prereesources?(app: Express): void;
    postresource?(app: Express): void;
    annotatedFilter?(req: HttpRequest, res: HttpResponse | Websocket, next: (req: HttpRequest, res: HttpResponse) => void): void
}) {
    await loadFiles(rootpath);
    console.log('laoded files');

    const app: ExpressWs = express();
    require('express-ws')(app);
    if (options.allowCors) {
        app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
    }

    app.use(express.json({ limit: '800mb' }));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.text());

    if (options && options.prereesources) {
        options.prereesources(app);
    }

    resources.sort((r1, r2) => r1.path > r2.path ? 1 : -1);
    for (let resource of resources) {
        const filePath = resource.target.constructor.path ? '/' + resource.target.constructor.path : '';
        const resourcePath = resource.path.startsWith('/') || resource.path === '' ? resource.path : '/' + resource.path;
        const fullPath = `/rest${filePath}${resourcePath}`;
        console.log(`adding ${fullPath} with ${resource.type.toLocaleUpperCase()}`);


        if (resource.type === 'ws') {
            app[resource.type](fullPath, (ws, req: HttpRequest) => {
                req.attributes = resource.attributes
                if (options.annotatedFilter) {
                    options.annotatedFilter(req, ws, () => {
                        resource.target.onConnected(req, ws);
                    })
                } else {
                    resource.target.onConnected(req, ws);
                }
            });
        } else {
            const resourceCallback = async (req, res) => {
                try {
                    await resource.callback.call(resource.target, req, res);
                } catch (e) {
                    if (e instanceof ResponseCodeError) {
                        let body = JSON.stringify(e.reason);
                        if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
                            body += '<button onclick="history.back()">back</button>';
                        }
                        return res.status(e.code)
                            .send(body);
                    }
                    console.error(e);
                    res.status(500)
                        .send(e);
                }
            };
            app[resource.type](fullPath, (req: HttpRequest, res) => {
                req.attributes = resource.attributes
                if (options.annotatedFilter) {
                    options.annotatedFilter(req, res, resourceCallback)
                } else {
                    resourceCallback(req, res)
                }
            });
        }
    }

    if (options && options.postresource) {
        options.postresource(app);
    }
    if (options.public) {
        app.use(express.static(options.public));
        app.all('/*', (req, res) => {
            res.sendFile(options.public + '/index.html');
        });
    }

    app.listen(8080, '', () => {
        console.log('started server on localhost with port 8080');
    });
}

async function loadFiles(path: string) {
    const files = await promises.readdir(path);
    await Promise.all(files.map(async (file) => {
        const absolutePath = join(path, file);
        const stats = await promises.stat(absolutePath);
        if (stats.isFile()) {
            await loadFile(absolutePath);
        } else if (stats.isDirectory()) {
            await loadFiles(absolutePath);
        }

    }));
}

async function loadFile(absolutePath: string) {
    if (absolutePath.endsWith('.js') || absolutePath.endsWith('.ts')) {
        const data = await promises.readFile(absolutePath);
        if (data.includes('express-hibernate-wrapper')) {
            require(absolutePath);
        }
    }
}