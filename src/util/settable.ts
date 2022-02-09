

interface SetterConfig {
    onlyWhenFalsy?: boolean
}

interface Setter extends SetterConfig {
    key: string;
    validation?(value): Promise<string>;
}

const setters: { [key: string]: Array<Setter> } = {}

export function settableValidator(validationFunction) {
    return (target, propertyKey: string) => {
        //const objR = target as { __setters?: Array<Setter> };
        if (!setters[target.constructor]) {
            setters[target.constructor] = [];
        }
        setters[target.constructor].push({ key: propertyKey, validation: validationFunction });
    };
}
export function settableCfg(cfg: SetterConfig = {}) {
    return function (target, propertyKey: string) {
        //const objR = target as { __setters?: Array<Setter> };
        if (!setters[target.constructor]) {
            setters[target.constructor] = [];
        }
        setters[target.constructor].push({ key: propertyKey, ...cfg });
    }
}

export function settable(target, propertyKey: string) {
    //const objR = target as { __setters?: Array<Setter> };
    if (!setters[target.constructor]) {
        setters[target.constructor] = [];
    }
    setters[target.constructor].push({ key: propertyKey });
}

export async function assign(obj, data, options: { onlyWhenFalsy?: boolean } = {}) {
    const objR = obj as { __setters?: Array<Setter> };
    const errorCollector = {};
    if (setters[obj.constructor]) {
        for (const key of setters[obj.constructor]) {
            if (Object.keys(data).map(k => k.split(".")[0]).includes(key.key)) {
                let newObject;
                if (key.validation) {
                    const errorObj = await key.validation.bind(objR)(data[key.key]);
                    if (errorObj) {
                        errorCollector[key.key] = errorObj;
                        continue
                    } else {
                        newObject = data[key.key];
                    }
                } else {
                    newObject = data[key.key];
                }

                if (newObject) {
                    const onlyWhenFalsy = (options.onlyWhenFalsy || key.onlyWhenFalsy)
                    if (!onlyWhenFalsy || !objR[key.key]) {
                        objR[key.key] = newObject;
                    }
                }
            }
        }
    }

    if (Object.keys(errorCollector).length) {
        return errorCollector;
    }
    return null;
}