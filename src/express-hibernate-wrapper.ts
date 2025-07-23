
import { HttpRequest, resources } from './express-wrapper';
import { ResponseCodeError } from './response-code-error';
import { assign } from './util/settable';
import { getDBConfig } from 'hibernatets/utils';
import { load, MariaDbBase, queries, remove, save } from 'hibernatets';
import type { LoadOptions } from 'hibernatets/load';
import { DataBaseBase } from 'hibernatets';


export interface ConstructorClass<T> {
    new(...args): T;
}


export function getter<T>(opts: {
    name: string,
    condition?: string | ((obj, req) => (string | number | boolean))
}) {
    if (!opts.condition) {
        opts.condition = "TRUE = TRUE"
    }
    if (opts.condition == "id") {
        opts.name = `${opts.name}/:${opts.name}`
    }
    return function (target: ConstructorClass<T>) {
        resources.push({
            path: `auto/${target.name.toLowerCase()}/${opts.name}`,
            type: "get",
            target: target,
            callback: async (req: HttpRequest, res) => {
                let condition: (obj: T) => unknown = opts.condition as never;
                if (opts.condition == "id") {
                    condition = (o) => o[getDBConfig(target).modelPrimary] = req.params[opts.name]
                }
                if (opts.condition && typeof opts.condition !== "string") {
                    const condtionFnc = opts.condition;
                    condition = (obj) => condtionFnc(obj, req)
                }
                const response = await load(target, condition);
                if (!response || response.length == 0) {
                    res.status(404).send()
                    return;
                }
                res.send(response);

            }
        })
    }
}

export function autosaveable(target) {

    return autosaveableWithOpts()(target)

}
export function autosaveableWithOpts(opts?: { poolGen?: () => DataBaseBase }) {

    return function (target) {
        resources.push({
            path: `auto/${target.name.toLowerCase()}`,
            target: target,
            type: 'put',
            callback: async (req, res) => {
                if (!req.body.itemRef) {
                    return res.status(400).send("missing 'itemRef' id key")
                }

                const pool = opts?.poolGen ? opts?.poolGen() : new MariaDbBase()
                const obj = await load(target, +req.body.itemRef, undefined, {
                    db: pool
                });
                if (!obj) {
                    return res.status(404).send("didnt find oject with itemRef as id")
                }
                const errors = await assign(obj, req.body);
                if (errors) {
                    res.status(400)
                        .send(errors);
                    return;
                }

                await queries(obj);
                pool.end()
                res.send(obj);
            }
        })

        resources.push({
            path: `auto/${target.name.toLowerCase()}`,
            target: target,
            type: 'delete',
            callback: async (req, res) => {
                if (!req.query.itemRef) {
                    return res.status(400).send("missing 'itemRef' id key")
                }
                const obj = await remove(target, +req.query.itemRef, { deep: true });
                await queries(obj);
                res.status(200).send(`${obj}`);
            }
        })

        resources.push({
            path: `auto/${target.name.toLowerCase()}`,
            target: target,
            type: 'post',
            callback: async (req, res) => {
                const obj = new target();
                await assign(obj, req.body)
                await save(obj);
                res.send(obj);
            }
        })
    }

}

export async function loadOne<T>(
    findClass: ConstructorClass<T>,
    primaryKeyOrFilter,
    params: Array<string | number> | string,
    opts: LoadOptions<T> = {}): Promise<T> {
    const obj = await load(findClass, primaryKeyOrFilter, params, { ...opts, first: true })
    if (!obj) {
        throw new ResponseCodeError(404, `${findClass.name} not found`)
    }
    return obj;
}