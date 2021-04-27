
interface Setter {
    key: string;
    validation?(value): Promise<string>;
}

const setters: { [key: string]: Array<{ key: string, validation?: (value) => Promise<string> }> } = {}

export function settableValidator(validationFunction) {
    return (target, propertyKey: string) => {
        //const objR = target as { __setters?: Array<Setter> };
        if (!setters[target.constructor]) {
            setters[target.constructor] = [];
        }
        setters[target.constructor].push({ key: propertyKey, validation: validationFunction });
    };
}

export function settable(target, propertyKey: string) {
    //const objR = target as { __setters?: Array<Setter> };
    if (!setters[target.constructor]) {
        setters[target.constructor] = [];
    }
    setters[target.constructor].push({ key: propertyKey });
}

export async function assign(obj, data) {
    const objR = obj as { __setters?: Array<Setter> };
    const errorCollector = {};
    if (setters[obj.constructor]) {
        for (const key of setters[obj.constructor]) {
            if (Object.keys(data).map(k => k.split(".")[0]).includes(key.key)) {
                if (key.validation) {
                    const errorObj = await key.validation.bind(objR)(data[key.key]);
                    if (errorObj) {
                        errorCollector[key.key] = errorObj;
                    } else {
                        objR[key.key] = data[key.key];
                    }
                } else {
                    objR[key.key] = data[key.key];
                }
            }
        }
    }

    if (Object.keys(errorCollector).length) {
        return errorCollector;
    }
    return null;
}